
const fs = require('fs');
const path = require('path');

/**
 * Генерирует секцию HTML для одного отчета.
 * @param {object} reportData - Данные из одного JSON-отчета.
 * @param {string} originalFileName - Имя исходного файла для заголовка.
 * @returns {string} - HTML-строка для секции.
 */
function generateReportSection(reportData, originalFileName) {
  const { aggregate } = reportData;
  if (!aggregate) return '<h2>Ошибка: Секция "aggregate" не найдена в отчете.</h2>';

  const counters = aggregate.counters || {};
  const summaries = aggregate.summaries || {};

  const requests = counters['http.requests'] || 0;
  const vusersCompleted = counters['vusers.completed'] || 0;
  const errors = counters['vusers.failed'] || 0;
  const rps = (aggregate.rates && aggregate.rates['http.request_rate']) ? aggregate.rates['http.request_rate'].toFixed(2) : 'N/A';
  
  const latency = summaries['http.response_time'] || {};

  let endpointsHtml = '';
  const endpointMetrics = Object.keys(summaries)
    .filter(key => key.startsWith('plugins.metrics-by-endpoint.response_time.'))
    .map(key => ({
      name: key.replace('plugins.metrics-by-endpoint.response_time.', ''),
      data: summaries[key],
    }));

  if (endpointMetrics.length > 0) {
    endpointsHtml += '<h4>Время ответа по эндпоинтам:</h4><table><tr><th>Эндпоинт</th><th>Запросов</th><th>Среднее</th><th>p95</th><th>p99</th></tr>';
    endpointMetrics.forEach(ep => {
      endpointsHtml += `<tr>
        <td>${ep.name}</td>
        <td>${ep.data.count}</td>
        <td>${ep.data.mean.toFixed(2)} мс</td>
        <td>${(ep.data.p95 || 'N/A')} мс</td>
        <td>${(ep.data.p99 || 'N/A')} мс</td>
      </tr>`;
    });
    endpointsHtml += '</table>';
  }

  const testName = originalFileName.replace(/artillery_report_|_/g, ' ').replace('.json', '').replace(/\d{4}-.*/, '').trim();

  return `
    <div class="section">
      <h2>Отчет по тесту: <span class="test-name">${testName}</span></h2>
      <div class="grid">
        <div class="card">
          <h4>Ключевые метрики</h4>
          <table>
            <tr><td>Всего запросов</td><td>${requests}</td></tr>
            <tr><td>Успешных вирт. пользователей</td><td>${vusersCompleted}</td></tr>
            <tr><td>Средний RPS</td><td>${rps}</td></tr>
            <tr><td>Ошибки</td><td class="${errors > 0 ? 'errors' : ''}">${errors}</td></tr>
          </table>
        </div>
        <div class="card">
          <h4>Задержка (Response Time)</h4>
          <table>
            <tr><td>Минимальная</td><td>${latency.min || 'N/A'} мс</td></tr>
            <tr><td>Средняя</td><td>${(latency.mean || 0).toFixed(2)} мс</td></tr>
            <tr><td>p95</td><td>${latency.p95 || 'N/A'} мс</td></tr>
            <tr><td>p99</td><td>${latency.p99 || 'N/A'} мс</td></tr>
            <tr><td>Максимальная</td><td>${latency.max || 'N/A'} мс</td></tr>
          </table>
        </div>
        <div class="card wide">
          ${endpointsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Генерирует полную HTML-страницу из нескольких отчетов.
 * @param {Array<{data: object, filename: string}>} reports - Массив данных отчетов.
 * @returns {string} - Полная HTML-страница.
 */
function generateHtml(reports) {
  const reportSections = reports.map(r => generateReportSection(r.data, r.filename)).join('');
  
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Сводный отчет по нагрузочному тестированию</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background-color: #f4f7f9; color: #333; }
        header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
        header h1 { margin: 0; }
        main { padding: 20px; }
        .section { background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; padding: 20px; }
        .section h2 { margin-top: 0; color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; }
        .test-name { color: #2980b9; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: #ecf0f1; padding: 15px; border-radius: 5px; }
        .card.wide { grid-column: 1 / -1; }
        h4 { margin-top: 0; color: #7f8c8d; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #dcdcdc; }
        tr:last-child td { border-bottom: none; }
        td:last-child { font-weight: bold; text-align: right; }
        .errors { color: #c0392b; }
      </style>
    </head>
    <body>
      <header>
        <h1>Сводный отчет по нагрузочному тестированию</h1>
        <p>Сгенерировано: ${new Date().toLocaleString()}</p>
      </header>
      <main>
        ${reportSections}
      </main>
    </body>
    </html>
  `;
}

/**
 * Основная функция.
 */
function main() {
  const jsonPaths = process.argv.slice(2);
  if (jsonPaths.length === 0) {
    console.log('Использование: node scripts/json-to-html.js <путь/к/файлу1.json> [<путь/к/файлу2.json> ...]');
    return;
  }

  const reports = [];
  for (const jsonPath of jsonPaths) {
    try {
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      reports.push({
        data: JSON.parse(fileContent),
        filename: path.basename(jsonPath),
      });
    } catch (e) {
      console.error(`Ошибка при чтении или парсинге файла ${jsonPath}:`, e);
    }
  }

  if (reports.length > 0) {
    const htmlContent = generateHtml(reports);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlFileName = `artillery_html_report_${timestamp}.html`;
    const htmlFilePath = path.resolve(process.cwd(), htmlFileName);
    
    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log(`\n✅ HTML-отчет успешно сгенерирован: ${htmlFilePath}`);

    // Удаляем исходные JSON файлы
    console.log('\n🧹 Очистка временных JSON-файлов...');
    for (const jsonPath of jsonPaths) {
      try {
        fs.unlinkSync(jsonPath);
        console.log(`   - Удален: ${path.basename(jsonPath)}`);
      } catch (e) {
        console.error(`Не удалось удалить файл ${jsonPath}`);
      }
    }
  } else {
    console.error('Не удалось обработать ни одного файла отчета.');
  }
}

main();
