<?php
/**
 * Приём заявок с сайта ФлотСервис.
 *
 * Работает на обычном российском хостинге с PHP (Beget, Timeweb и т. п.):
 * 1) проверяет заявку и отсекает спам;
 * 2) сохраняет копию в data/leads.csv — заявка не потеряется, даже если письмо не дойдёт;
 * 3) отправляет письмо на почту компании.
 * Отвечает JSON: {"ok":true} или {"ok":false,"error":"..."}.
 */

declare(strict_types=1);
ini_set('display_errors', '0'); // предупреждения не должны портить JSON-ответ
date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ---------- Настройки ----------
const MAIL_TO      = 'flotservicecompany@mail.ru';
const DATA_DIR     = __DIR__ . '/data';
const RATE_LIMIT   = 5;     // не больше 5 заявок
const RATE_WINDOW  = 3600;  // с одного IP за час
const MIN_FILL_SEC = 3;     // форму быстрее 3 секунд заполняют только боты

function reply(bool $ok, string $error = '', int $code = 200): void {
    http_response_code($code);
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function field(string $name, int $max = 300): string {
    $v = isset($_POST[$name]) ? (string)$_POST[$name] : '';
    if (!mb_check_encoding($v, 'UTF-8')) $v = mb_convert_encoding($v, 'UTF-8', 'Windows-1251');
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '');
    return mb_substr($v, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(false, 'method', 405);

// ---------- Защита от спама ----------
// скрытое поле: человек его не видит и не заполняет
if (field('website') !== '') reply(true);
// слишком быстрое заполнение
$started = (int)field('started', 20);
if ($started > 0 && (time() - intdiv($started, 1000)) < MIN_FILL_SEC) reply(true);

if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0750, true);

// ограничение частоты по IP (храним только хэш IP)
$ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|flotservice');
$rateFile = DATA_DIR . '/rate.json';
$rate = is_file($rateFile) ? (json_decode((string)file_get_contents($rateFile), true) ?: []) : [];
$now = time();
foreach ($rate as $k => $times) {
    $rate[$k] = array_values(array_filter($times, fn($t) => $now - $t < RATE_WINDOW));
    if (!$rate[$k]) unset($rate[$k]);
}
if (count($rate[$ipHash] ?? []) >= RATE_LIMIT) reply(false, 'rate', 429);

// ---------- Данные заявки ----------
$lead = [
    'date'    => date('d.m.Y H:i'),
    'lang'    => field('lang', 2) === 'en' ? 'en' : 'ru',
    'name'    => field('name', 100),
    'phone'   => field('phone', 40),
    'company' => field('company', 150),
    'vessel'  => field('vessel', 100),
    'length'  => field('length', 40),
    'port'    => field('port', 60),
    'format'  => field('format', 60),
    'comment' => field('comment', 1500),
];

if (strlen(preg_replace('/\D/', '', $lead['phone'])) < 7) reply(false, 'phone', 422);
if (field('agree', 5) !== '1') reply(false, 'agree', 422);

$rate[$ipHash][] = $now;
@file_put_contents($rateFile, json_encode($rate), LOCK_EX);

// ---------- Копия заявки в CSV (папка data закрыта от посетителей через .htaccess) ----------
$csv = DATA_DIR . '/leads.csv';
$isNew = !is_file($csv);
$saved = false;
if ($fh = @fopen($csv, 'ab')) {
    flock($fh, LOCK_EX);
    if ($isNew) {
        fwrite($fh, "\xEF\xBB\xBF"); // BOM, чтобы Excel открыл кириллицу
        fputcsv($fh, ['Дата', 'Язык', 'Имя', 'Телефон', 'Компания', 'Судно', 'Длина', 'Порт', 'Формат', 'Комментарий'], ';', '"', '');
    }
    // защита от формул при открытии в Excel
    fputcsv($fh, array_map(fn($v) => preg_match('/^[=+\-@]/', $v) && !preg_match('/^\+\d/', $v) ? "'" . $v : $v, array_values($lead)), ';', '"', '');
    flock($fh, LOCK_UN);
    fclose($fh);
    $saved = true;
}

// ---------- Письмо ----------
$labels = [
    'name' => 'Имя', 'phone' => 'Телефон', 'company' => 'Компания', 'vessel' => 'Судно',
    'length' => 'Длина судна', 'port' => 'Порт', 'format' => 'Формат', 'comment' => 'Комментарий',
];
$body = "Новая заявка с сайта ФлотСервис" . ($lead['lang'] === 'en' ? ' (английская версия)' : '') . "\n";
$body .= $lead['date'] . "\n\n";
foreach ($labels as $k => $label) $body .= $label . ': ' . ($lead[$k] !== '' ? $lead[$k] : '—') . "\n";
$body .= "\nПозвонить: " . preg_replace('/[^\d+]/', '', $lead['phone']) . "\n";

$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$host = preg_replace('/^www\./', '', $host);
$subject = '=?UTF-8?B?' . base64_encode('Заявка на осмотр: ' . ($lead['vessel'] ?: $lead['phone'])) . '?=';
$headers = implode("\r\n", [
    'From: =?UTF-8?B?' . base64_encode('Сайт ФлотСервис') . "?= <no-reply@{$host}>",
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
]);

$sent = @mail(MAIL_TO, $subject, chunk_split(base64_encode($body)), $headers);

// если не удалось ни сохранить, ни отправить — сообщаем, и сайт предложит отправить письмо вручную
if (!$saved && !$sent) reply(false, 'server', 500);
reply(true);
