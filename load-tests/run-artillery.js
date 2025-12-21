

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const ALL_TESTS = ['gallery', 'upload', 'interaction'];

/**
 * Ожидает, пока сервер станет доступен.
 * @returns {Promise<void>}
 */
const waitForServer = (timeout = 30000) => {
  console.log(`\n⏳ Ожидание запуска сервера по адресу ${SERVER_URL}...`);
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const tryConnect = () => {
      http.get(SERVER_URL, (res) => {
        console.log(`✅ Сервер запущен (статус: ${res.statusCode}).`);
        resolve();
      }).on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Не удалось подключиться к серверу в течение ${timeout / 1000}с.`));
        } else {
          setTimeout(tryConnect, 1000);
        }
      });
    };
    tryConnect();
  });
};

/**
 * Проверяет, есть ли изображения в галерее.
 * @returns {Promise<boolean>}
 */
const checkInteractionPrerequisites = () => {
  console.log('\n🔎 Проверка условий для теста "interaction"...');
  return new Promise((resolve) => {
    http.get(`${SERVER_URL}/all`, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const images = JSON.parse(body);
          if (Array.isArray(images) && images.length > 0) {
            console.log('   ... в галерее есть изображения. Тест будет выполнен.');
            resolve(true);
          } else {
            console.warn('   ... ⚠️  ВНИМАНИЕ: В галерее нет изображений. Тест "interaction" будет пропущен.');
            resolve(false);
          }
        } catch (e) {
          console.error('   ... ошибка парсинга ответа от /all. Тест "interaction" будет пропущен.');
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error(`   ... не удалось выполнить проверку: ${err.message}. Тест "interaction" будет пропущен.`);
      resolve(false);
    });
  });
};


/**
 * Запускает один тест Artillery и возвращает путь к JSON-отчету.
 * @param {string} testName - Имя теста.
 * @returns {string|null}
 */
const runArtilleryTest = (testName) => {
  console.log(`\n▶️  Запуск Artillery теста: ${testName}`);
  const ymlFile = path.join(__dirname, `${testName}.artillery.yml`);
  // Создаем временный JSON в той же директории для простоты
  const jsonReportFile = path.join(__dirname, `temp_report_${testName}.json`);
  
  const command = `artillery run --quiet "${ymlFile}" -o "${jsonReportFile}"`;

  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`\n   ... JSON-отчет для '${testName}' сохранен временно.`);
    return jsonReportFile;
  } catch (error) {
    console.error(`\n❌ Ошибка во время выполнения Artillery теста: ${testName}.`);
    return null;
  }
};

/**
 * Основная функция-оркестратор.
 */
const main = async () => {
  console.log('🚀 Запуск приложения для тестирования...');
  const serverProcess = spawn('npm', ['start'], { shell: true, detached: true });
  
  serverProcess.stdout.on('data', (data) => console.log(`[SERVER]: ${data.toString()}`));
  serverProcess.stderr.on('data', (data) => console.error(`[SERVER_ERROR]: ${data.toString()}`));

  const generatedJsonPaths = [];

  try {
    await waitForServer();

    const specificTest = process.argv[2];
    if (specificTest) {
      if (specificTest === 'interaction') {
        const canRun = await checkInteractionPrerequisites();
        if (canRun) {
            const reportPath = runArtilleryTest(specificTest);
            if(reportPath) generatedJsonPaths.push(reportPath);
        }
      } else {
        const reportPath = runArtilleryTest(specificTest);
        if(reportPath) generatedJsonPaths.push(reportPath);
      }
    } else {
      console.log('\n🔥 Запуск полного цикла тестов Artillery...');
      for (const testName of ALL_TESTS) {
        let canRun = true;
        if (testName === 'interaction') {
            canRun = await checkInteractionPrerequisites();
        }
        
        if (canRun) {
            const reportPath = runArtilleryTest(testName);
            if(reportPath) generatedJsonPaths.push(reportPath);
        }
      }
    }

    if (generatedJsonPaths.length > 0) {
      console.log('\n- - - - - - - - - - - - - - - - - - - -');
      console.log('✨ Тесты завершены. Генерация сводного HTML-отчета...');
      const reportPathsString = generatedJsonPaths.join(' ');
      try {
          execSync(`node scripts/json-to-html.js ${reportPathsString}`, { stdio: 'inherit' });
      } catch (e) {
          console.error('❌ Ошибка при создании HTML-отчета.');
      }
    }

  } catch (error) {
    console.error(`\n❌ ${error.message}`);
  } finally {
    console.log('\n🛑 Остановка сервера...');
    if (serverProcess.pid) {
      try {
        if (process.platform === "win32") {
            execSync(`taskkill /PID ${serverProcess.pid} /T /F`);
        } else {
            // Убиваем группу процессов на Unix-системах
            process.kill(-serverProcess.pid, 'SIGKILL');
        }
      } catch (e) {
        console.error('   ... не удалось остановить серверный процесс (возможно, он уже был остановлен).');
      }
    }
    console.log('✅ Сервер остановлен.');
  }
};

main();
