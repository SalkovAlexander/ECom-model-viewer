const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Секретный ключ для подписи и верификации токена
const secretKey = 'your-secret-key';

// Параметры подключения к базе данных PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ECom',
    password: '4065',
    port: 5432,
});

app.use(bodyParser.json());
app.use(cors());

// Роут для авторизации пользователя и выдачи токена
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Проверка логина и пароля (ваша бизнес-логика)
  if (await checkLogin(username, password) == true) {
    // Создание токена с данными пользователя
    const token = jwt.sign({ username }, secretKey, { expiresIn: '1h' });
    // Отправка токена в ответе
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Неправильный логин или пароль' });
  }
});

async function checkLogin(username, password) {
  try {
    // Выполнение запроса к базе данных для проверки логина и пароля
    const query = 'SELECT to_json(users) AS user_json FROM ( SELECT public."Users".login, public."Users".password FROM public."Users" WHERE login = ($1) AND password = ($2)) AS users;';
    const values = [username, password];
    let result = await pool.query(query, values);
    // result = JSON.parse(result);
    // console.log(result.rows[0].user_json.login + ' ' + result.rows[0].user_json.password + " " + typeof(result.rowCount));
    console.log(result.rowCount);
    if (result.rowCount > 0) {
      if(result.rows[0].user_json.login == username && result.rows[0].user_json.password == password)
      {
        return true;
      }
    } else {
      return false;
    }
  } catch (error) {
    console.error('Ошибка при выполнении запроса на сверку данных для авторизации:', error);
  }
}

// Роут, защищенный аутентификацией
app.post('/projects', authenticateToken, (req, res) => {
  //Получаем токен
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // Если токен прошел верификацию, можно предоставить доступ
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  pool.query('SELECT json_agg(json_build_object(\'project_id\', public."Projects".project_id, \'project_name\', public."Projects".project_name, \'hdri_link\', public."Projects".hdri_link, \'poster_link\', public."Projects".poster_link, \'project_key\', public."Projects".project_key ) ) AS project_data FROM public."Projects" WHERE owner_user_id = ( SELECT id FROM public."Users" WHERE login = ($1));',
  [username],
  (error, results) => {
    if (error) {
      console.error('Ошибка выполнения запроса:', error);
      res.status(500).send('Произошла ошибка на сервере');
    } else {
      // Отправка данных из базы данных в качестве ответа
      res.json(results.rows[0].project_data);
    }
  });
});

app.post('/changedata', authenticateToken, (req, res) => {
  //Получаем токен
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // Если токен прошел верификацию, можно предоставить доступ
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { id, column, newValue} = req.body;
  pool.query('UPDATE public."Projects" SET ' + column + ' = ($1) WHERE owner_user_id = ( SELECT id FROM public."Users" WHERE login = ($2) ) AND project_id = ($3);',
  [newValue, username, id],
  (error, results) => {
    if (error) {
      console.error('Ошибка выполнения запроса:', error);
      res.status(500).send('Произошла ошибка на сервере');
    } else {
      // Отправка данных из базы данных в качестве ответа
      res.json({ message: 'ok' });
    }
  });
});

// Middleware для верификации токена
function authenticateToken(req, res, next) {
  // Получение токена из заголовка Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }

  // Верификация токена
  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Неверный токен' });
    }

    // Добавление информации о пользователе в объект запроса
    req.user = user;

    // Продолжение выполнения следующего middleware
    next();
  });
}

// Обработчик POST-запроса
app.post('/data', (req, res) => {
  // Получение данных из тела запроса
  const key = req.body.CatalogKey;
  console.log('Получение каталога проекта с key: ' + key);

  // Запрос к базе данных
  pool.query('SELECT json_agg(json_build_object( \'GroupName\', project_name, \'HDRILink\', hdri_link, \'PosterLink\', poster_link, \'Models\', ( SELECT json_agg(json_build_object( \'ModelName\', model_name, \'ModelLink\', model_link, \'TumbnailLink\', tumbnail_link, \'MaterialVariants\', ( SELECT json_agg(json_build_object( \'MateriaVariantName\', material_variant_name, \'MaterialVariantLink\', material_variant_tumbnail_link )) FROM public."Material_variants" WHERE material_variant_owner_id = public."3d_models".model_id ) )) FROM public."3d_models" WHERE owner_project_id = public."Projects".project_id ) )) AS project_data FROM public."Projects" WHERE project_key = ($1) GROUP BY project_name;',
    [key],
    (error, results) => {
      if (error) {
        console.error('Ошибка выполнения запроса:', error);
        res.status(500).send('Произошла ошибка на сервере');
      } else {
        // Отправка данных из базы данных в качестве ответа
        res.json(results.rows[0].project_data);
      }
    }
  );
});

// Запуск сервера на порту 3000
app.listen(3000, 'localhost', () => {
  console.log('Сервер запущен на порту 3000');
});