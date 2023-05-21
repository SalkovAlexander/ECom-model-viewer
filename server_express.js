const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');

// Параметры подключения к базе данных PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'ECom',
    password: '4065',
    port: 5432,
});

app.use(bodyParser.text());
app.use(cors());

// Обработчик POST-запроса
app.post('/data', (req, res) => {
  // Получение данных из тела запроса
  let key = req.body;
  console.log(key);

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