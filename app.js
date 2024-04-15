const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Middleware para parsear el cuerpo de las solicitudes JSON

// Configuración de la conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Estebanaleman1',
  database: 'anatomy_database'
});

// Ruta para obtener un sistema por ID
app.get('/systems/:id', (req, res) => {
  const systemId = req.params.id;
  const query = 'SELECT * FROM systems WHERE id = ?';
  connection.query(query, [systemId], (error, results) => {
    if (error) throw error;
    res.send(results[0]);
  });
});

// Ruta para obtener preguntas y respuestas de un sistema y nivel de dificultad
app.get('/systems/:systemId/:difficulty', (req, res) => {
    const systemId = req.params.systemId;
    const difficulty = req.params.difficulty;
  
    // Consulta para obtener preguntas y respuestas
    const query = `
      SELECT q.question, json_arrayagg(json_object('answer', a.answer, 'isCorrect', a.is_correct)) as answers
      FROM questions q
      JOIN answers a ON q.id = a.question_id
      WHERE q.system_id = ? AND q.difficulty = ?
      GROUP BY q.id
    `;
  
    connection.query(query, [systemId, difficulty], (error, results) => {
      if (error) throw error;
  
      const questionsWithAnswers = results.map(result => ({
        question: result.question,
        answers: JSON.parse(result.answers)
      }));
  
      res.send(questionsWithAnswers);
    });
  });

  // Bueno
  app.get('/quiz/:systemId', (req, res) => {
    const { systemId } = req.params;
    const { difficulty } = req.query; // Extracting the difficulty from query parameters

    let query = `
    SELECT 
        q.id AS question_id, 
        q.question, 
        dl.level_name AS difficulty, 
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', a.id,
                'text', a.answer,
                'isCorrect', CAST(a.is_correct AS UNSIGNED) = 1  -- Explicitly cast and compare to produce a Boolean 
            )
        ) AS answers 
    FROM questions q
    JOIN answers a ON q.id = a.question_id
    JOIN difficulty_levels dl ON q.difficulty_id = dl.id
    WHERE q.system_id = ?
`;

    const queryParams = [systemId];

    if (difficulty) {
        query += ' AND dl.level_name = ?';
        queryParams.push(difficulty);
    }

    query += ' GROUP BY q.id ORDER BY q.id;';

    connection.query(query, queryParams, (error, results) => {
        if (error) {
            res.status(500).send('Server error');
            console.error(error);
            return;
        }
        res.json(results.map(row => ({
            id: row.question_id,
            text: row.question,
            difficulty: row.difficulty,
            answers: JSON.parse(row.answers)
        })));
    });
});


  

  app.get('/systems', (req, res) => {
    const query = 'SELECT id, name, model_name AS modelName, description FROM systems';
    connection.query(query, (error, results) => {
      if (error) {
        res.status(500).send('Server error');
        console.error(error);
        return;
      }
      res.json(results);
    });
  });

  app.post('/users/register', (req, res) => {
    const { name, student_id, password } = req.body;

    const query = 'INSERT INTO Users (name, student_id, password) VALUES (?, ?, ?)';
    
    connection.query(query, [name, student_id, password], (error, results) => {
        if (error) {
            console.error('Error inserting data into Users table:', error);
            return res.status(500).send('Failed to register user');
        }
        res.status(201).send(`User registered with ID: ${results.insertId}`);
    });
});

app.post('/users/login', (req, res) => {
  const { student_id, password } = req.body;

  const query = 'SELECT * FROM Users WHERE student_id = ? AND password = ?';
  
  connection.query(query, [student_id, password], (error, results) => {
      if (error) {
          console.error('Error querying Users table:', error);
          return res.status(500).send('Login failed');
      }
      if (results.length > 0) {
          res.send('Login successful');
      } else {
          res.status(401).send('Invalid credentials');
      }
  });
});

  
  
  

// Ruta para crear un nuevo sistema
app.post('/systems', (req, res) => {
  const { name, modelName, description } = req.body;
  const query = 'INSERT INTO systems (name, model_name, description) VALUES (?, ?, ?)';
  connection.query(query, [name, modelName, description], (error, results) => {
    if (error) throw error;
    res.send(`Sistema creado con ID: ${results.insertId}`);
  });
});

// Ruta para actualizar un sistema existente
app.put('/systems/:id', (req, res) => {
  const systemId = req.params.id;
  const { name, modelName, description } = req.body;
  const query = 'UPDATE systems SET name = ?, model_name = ?, description = ? WHERE id = ?';
  connection.query(query, [name, modelName, description, systemId], (error, results) => {
    if (error) throw error;
    res.send(`Sistema con ID ${systemId} actualizado`);
  });
});

// Ruta para eliminar un sistema
app.delete('/systems/:id', (req, res) => {
  const systemId = req.params.id;
  const query = 'DELETE FROM systems WHERE id = ?';
  connection.query(query, [systemId], (error, results) => {
    if (error) throw error;
    res.send(`Sistema con ID ${systemId} eliminado`);
  });
});

// Ruta para crear una nueva pregunta
app.post('/questions', (req, res) => {
  const { systemId, difficulty, question } = req.body;
  const query = 'INSERT INTO questions (system_id, difficulty, question) VALUES (?, ?, ?)';
  connection.query(query, [systemId, difficulty, question], (error, results) => {
    if (error) throw error;
    res.send(`Pregunta creada con ID: ${results.insertId}`);
  });
});

// Ruta para crear una nueva respuesta
app.post('/answers', (req, res) => {
  const { questionId, answer, isCorrect } = req.body;
  const query = 'INSERT INTO answers (question_id, answer, is_correct) VALUES (?, ?, ?)';
  connection.query(query, [questionId, answer, isCorrect], (error, results) => {
    if (error) throw error;
    res.send(`Respuesta creada con ID: ${results.insertId}`);
  });
});

// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor en ejecución en http://localhost:3000');
});