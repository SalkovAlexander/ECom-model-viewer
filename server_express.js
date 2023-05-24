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
    const token = jwt.sign({ username }, secretKey, { expiresIn: '3h' });
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
      if (result.rows[0].user_json.login == username && result.rows[0].user_json.password == password) {
        return true;
      }
    } else {
      return false;
    }
  } catch (error) {
    console.error('Ошибка при выполнении запроса на сверку данных для авторизации:', error);
  }
}

// Функция для получения токена из запроса
function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  return token;
}

// Функция для обработки ошибок
function handleError(res, error) {
  console.error('Ошибка выполнения запроса:', error);
  res.status(500).send('Произошла ошибка на сервере');
}

// Маршрут для получения проектов
app.post('/projects', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;

  const query = `
    SELECT json_agg(json_build_object('project_id', public."Projects".project_id, 'project_name', public."Projects".project_name, 'hdri_link', public."Projects".hdri_link, 'poster_link', public."Projects".poster_link, 'project_key', public."Projects".project_key)) AS project_data
    FROM public."Projects"
    WHERE owner_user_id = (SELECT id FROM public."Users" WHERE login = $1)
  `;

  pool.query(query, [username])
    .then(results => {
      res.json(results.rows[0].project_data);
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для получения моделей
app.post('/models', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { projectId } = req.body;

  const query = `
  SELECT json_agg(json_build_object(
    'model_id', public."3d_models".model_id,
    'model_name', public."3d_models".model_name,
    'model_link', public."3d_models".model_link,
    'tumbnail_link', public."3d_models".tumbnail_link
    )) AS project_data
    FROM public."Projects"
    JOIN public."3d_models" ON public."3d_models".owner_project_id = public."Projects".project_id
    WHERE public."Projects".project_id = ($2) 
    AND "Projects".owner_user_id = (SELECT public."Users".id FROM public."Users" WHERE public."Users".login = ($1))
  `;

  pool.query(query, [username, projectId])
    .then(results => {
      console.log('Пользователь ' + username + ' получил перечень моделей для проекта с id = ' + projectId);
      res.json(results.rows[0].project_data);
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для получения вариантов
app.post('/variants', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { modelId } = req.body;

  const query = `
  SELECT json_agg(json_build_object(
    'material_variant_id', public."Material_variants".material_variant_id,
    'material_variant_name', public."Material_variants".material_variant_name,
    'material_variant_tumbnail_link', public."Material_variants".material_variant_tumbnail_link
    )) AS variant_data
  FROM public."Material_variants"
  JOIN public."3d_models" ON public."Material_variants".material_variant_owner_id = public."3d_models".model_id
  JOIN public."Projects" ON public."3d_models".owner_project_id = public."Projects".project_id
  JOIN public."Users" ON public."Projects".owner_user_id = public."Users".id
  WHERE public."3d_models".model_id = ($2)
    AND public."Users".login = ($1);
  `;

  pool.query(query, [username, modelId])
    .then(results => {
      console.log('Пользователь ' + username + ' получил перечень вариантов для модели с id = ' + modelId);
      res.json(results.rows[0].variant_data);
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для добавления модели в проект
app.post('/models/add', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { projectId } = req.body;

  const query = `
    INSERT INTO public."3d_models" (owner_project_id)
    SELECT ($2)
    FROM public."Projects"
    WHERE project_id = ($2) AND owner_user_id = (SELECT public."Users".id FROM public."Users" WHERE public."Users".login = ($1));
  `;

  pool.query(query, [username, projectId])
    .then(() => {
      console.log('Пользователь ' + username + ' создал новый проект');
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для добавления проекта
app.post('/projects/add', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;

  const query = `
    INSERT INTO public."Projects" (owner_user_id)
    VALUES ((SELECT id FROM public."Users" WHERE login = $1))
  `;

  pool.query(query, [username])
    .then(() => {
      console.log('Пользователь ' + username + ' создал новый проект');
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для добавления варианта в модель
app.post('/variants/add', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { modelId } = req.body;

  const query = `
  INSERT INTO public."Material_variants" (material_variant_owner_id)
  SELECT ($2)
  FROM public."3d_models"
  JOIN public."Projects" ON public."3d_models".owner_project_id = public."Projects".project_id
  JOIN public."Users" ON public."Projects".owner_user_id = public."Users".id
  WHERE public."3d_models".model_id = ($2)
    AND public."Users".login = ($1);
  `;

  pool.query(query, [username, modelId])
    .then(() => {
      console.log('Пользователь ' + username + ' создал новый проект');
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для удаления проекта
app.post('/projects/delete', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { id } = req.body;

  const query = `
    DELETE FROM public."Projects"
    WHERE project_id = $2 AND owner_user_id = (SELECT id FROM public."Users" WHERE login = $1)
      AND NOT EXISTS (SELECT 1 FROM public."3d_models" WHERE owner_project_id = $2)
  `;

  pool.query(query, [username, id])
    .then(() => {
      console.log('Пользователь ' + username + ' удалил проект с id = ' + id);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для удаления моделей
app.post('/models/delete', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { modelId, projectId } = req.body;

  const query = `
  DELETE FROM public."3d_models"
  WHERE model_id = ($3)
    AND owner_project_id = ($2)
    AND EXISTS (
      SELECT 1
      FROM public."Projects"
      WHERE project_id = ($2)
        AND owner_user_id = (SELECT public."Users".id FROM public."Users" WHERE public."Users".login = ($1))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public."Material_variants"
      WHERE material_variant_owner_id = ($3)
    );
  `;

  pool.query(query, [username, projectId, modelId])
    .then(() => {
      console.log('Пользователь ' + username + ' удалил модель с id = ' + modelId);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для удаления вариантов
app.post('/variants/delete', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { modelId, variantId } = req.body;

  const query = `
  DELETE FROM public."Material_variants"
  WHERE material_variant_id = ($3)
    AND EXISTS (
      SELECT 1
      FROM public."3d_models"
      JOIN public."Projects" ON public."3d_models".owner_project_id = public."Projects".project_id
      JOIN public."Users" ON public."Projects".owner_user_id = public."Users".id
      WHERE public."3d_models".model_id = ($2)
        AND public."Users".login = ($1)
        AND public."Material_variants".material_variant_owner_id = public."3d_models".model_id
    );
  `;

  pool.query(query, [username, modelId, variantId])
    .then(() => {
      console.log('Пользователь ' + username + ' удалил вариант с id = ' + variantId);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для изменения данных проекта
app.post('/changedata', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { id, column, newValue } = req.body;

  const query = `
    UPDATE public."Projects"
    SET ${column} = $1
    WHERE owner_user_id = (SELECT id FROM public."Users" WHERE login = $2) AND project_id = $3
  `;

  pool.query(query, [newValue, username, id])
    .then(() => {
      console.log('Пользователь ' + username + ' изменил значение поле ' + column + ' проекта с id = ' + id + ' на ' + newValue);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для изменения данных модели
app.post('/models/change', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { projectId, modelId, newValue, column } = req.body;

  const query = `
  UPDATE public."3d_models"
  SET ${column} = ($4)
  WHERE model_id = ($3)
    AND owner_project_id = ($2)
    AND EXISTS (
      SELECT 1
      FROM public."Projects"
      WHERE project_id = ($2)
        AND owner_user_id = (SELECT public."Users".id FROM public."Users" WHERE public."Users".login = ($1))
    );
  `;

  pool.query(query, [username, projectId, modelId, newValue])
    .then(() => {
      console.log('Пользователь ' + username + ' изменил значение поле ' + column + ' модели с id = ' + modelId + ' на ' + newValue);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для изменения данных модели
app.post('/variants/change', authenticateToken, (req, res) => {
  const token = getTokenFromRequest(req);
  const decodedToken = jwt.verify(token, secretKey);
  const username = decodedToken.username;
  const { projectId, variantId, newValue, column } = req.body;
  console.log(projectId, variantId, newValue, column);
  const query = `
  UPDATE public."Material_variants"
    SET ${column} = ($4)
    WHERE material_variant_id = ($3)
    AND EXISTS (
    SELECT 1
    FROM public."3d_models"
    JOIN public."Projects" ON public."3d_models".owner_project_id = public."Projects".project_id
    JOIN public."Users" ON public."Projects".owner_user_id = public."Users".id
    WHERE public."3d_models".model_id = public."Material_variants".material_variant_owner_id
      AND public."Users".login = ($1)
      AND public."Projects".project_id = ($2)
  );
  `;

  pool.query(query, [username, projectId, variantId, newValue])
    .then(() => {
      console.log('Пользователь ' + username + ' изменил значение поле ' + column + ' варианта с id = ' + variantId + ' на ' + newValue);
      res.json({ status: 'ok' });
    })
    .catch(error => {
      handleError(res, error);
    });
});

// Маршрут для выдачи каталога по ключу проекта
app.post('/data', (req, res) => {
  const key = req.body.CatalogKey;
  console.log('Получение каталога проекта с key: ' + key);

  const query = `
    SELECT json_agg(json_build_object(
      'GroupName', project_name,
      'HDRILink', hdri_link,
      'PosterLink', poster_link,
      'Models', (
        SELECT json_agg(json_build_object(
          'ModelName', model_name,
          'ModelLink', model_link,
          'TumbnailLink', tumbnail_link,
          'MaterialVariants', (
            SELECT json_agg(json_build_object(
              'MateriaVariantName', material_variant_name,
              'MaterialVariantLink', material_variant_tumbnail_link
            ))
            FROM public."Material_variants"
            WHERE material_variant_owner_id = public."3d_models".model_id
          )
        ))
        FROM public."3d_models"
        WHERE owner_project_id = public."Projects".project_id
      )
    )) AS project_data
    FROM public."Projects"
    WHERE project_key = $1
    GROUP BY project_name
  `;

  pool.query(query, [key])
    .then(results => {
      res.json(results.rows[0].project_data);
    })
    .catch(error => {
      handleError(res, error);
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

// Запуск сервера на порту 3000
app.listen(3000, 'localhost', () => {
  console.log('Сервер запущен на порту 3000');
});