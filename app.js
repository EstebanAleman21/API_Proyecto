const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // Middleware para parsear el cuerpo de las solicitudes JSON

// Configuración de la conexión a MySQL
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Estebanaleman1",
  database: "anatomy_database",
});

// Ruta para obtener un sistema por ID
app.get("/systems/:id", (req, res) => {
  const systemId = req.params.id;
  const query = "SELECT * FROM systems WHERE id = ?";
  connection.query(query, [systemId], (error, results) => {
    if (error) throw error;
    res.send(results[0]);
  });
});

// Ruta para obtener preguntas y respuestas de un sistema y nivel de dificultad
app.get("/systems/:systemId/:difficulty", (req, res) => {
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

    const questionsWithAnswers = results.map((result) => ({
      question: result.question,
      answers: JSON.parse(result.answers),
    }));

    res.send(questionsWithAnswers);
  });
});

// Bueno
app.get("/quiz/:systemId", (req, res) => {
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
    query += " AND dl.level_name = ?";
    queryParams.push(difficulty);
  }

  query += " GROUP BY q.id ORDER BY q.id;";

  connection.query(query, queryParams, (error, results) => {
    if (error) {
      res.status(500).send("Server error");
      console.error(error);
      return;
    }
    res.json(
      results.map((row) => ({
        id: row.question_id,
        text: row.question,
        difficulty: row.difficulty,
        answers: JSON.parse(row.answers),
      }))
    );
  });
});

app.get("/systems", (req, res) => {
  const query =
    "SELECT id, name, model_name AS modelName, description FROM systems";
  connection.query(query, (error, results) => {
    if (error) {
      res.status(500).send("Server error");
      console.error(error);
      return;
    }
    res.json(results);
  });
});

app.post("/users/register", (req, res) => {
  const { name, student_id, password } = req.body;

  const query =
    "INSERT INTO Users (name, student_id, password) VALUES (?, ?, ?)";

  connection.query(query, [name, student_id, password], (error, results) => {
    if (error) {
      console.error("Error inserting data into Users table:", error);
      return res.status(500).send("Failed to register user");
    }
    res.status(201).send(`User registered with ID: ${results.insertId}`);
  });
});

app.post("/users/login", (req, res) => {
  const { student_id, password } = req.body;

  const query = "SELECT * FROM Users WHERE student_id = ? AND password = ?";

  connection.query(query, [student_id, password], (error, results) => {
    if (error) {
      console.error("Error querying Users table:", error);
      return res
        .status(500)
        .json({ error: "Login failed due to server error" });
    }
    if (results.length > 0) {
      // Assuming results[0] contains the user data you want to return
      const user = {
        id: results[0].user_id,
        name: results[0].name,
        studentID: results[0].student_id,
        // Do not send back the password or any sensitive data
      };
      res.json({
        message: "Login successful",
        user: user,
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });
});

app.post("/quiz/results", (req, res) => {
  const { userId, quizId, score, totalQuestions } = req.body;
  console.log("Attempting to save results for user_id:", userId);
  console.log(
    "Received for saving results:",
    userId,
    quizId,
    score,
    totalQuestions
  );
  const sql =
    "INSERT INTO user_quiz_results (user_id, quiz_id, score, total_questions, date_taken) VALUES (?, ?, ?, ?, NOW())";
  connection.query(
    sql,
    [userId, quizId, score, totalQuestions],
    (error, results) => {
      if (error) {
        console.error("Failed to insert quiz results:", error);
        return res
          .status(500)
          .json({ error: "Error saving results: " + error.message });
      }
      res.status(201).json({
        message: "Quiz result saved successfully",
        resultId: results.insertId,
      });
    }
  );
});

app.get("/users/:userId/profile", (req, res) => {
  const userId = req.params.userId;

  // Query to fetch user information
  const userInfoQuery = "SELECT name, student_id FROM Users WHERE user_id = ?";
  // Query to fetch the latest quiz result
  const latestQuizResultQuery = `
      SELECT score, total_questions, date_taken
      FROM user_quiz_results
      WHERE user_id = ?
      ORDER BY date_taken DESC
      LIMIT 1;
  `;

  connection.query(userInfoQuery, [userId], (error, userResults) => {
    if (error) {
      console.error("Error fetching user profile:", error);
      return res
        .status(500)
        .send({ message: "Error fetching user profile", error });
    }

    if (userResults.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    const userInfo = userResults[0];

    connection.query(latestQuizResultQuery, [userId], (error, quizResults) => {
      if (error) {
        console.error("Error fetching latest quiz result:", error);
        return res
          .status(500)
          .send({ message: "Error fetching latest quiz result", error });
      }

      const latestQuizResult = quizResults[0] || null;

      const userProfile = {
        userInfo: {
          name: userInfo.name,
          studentId: userInfo.student_id,
        },
        latestQuizResult: latestQuizResult
          ? {
              score: latestQuizResult.score,
              totalQuestions: latestQuizResult.total_questions,
              dateTaken: latestQuizResult.date_taken,
            }
          : null,
      };

      res.json(userProfile);
    });
  });
});

function validateInput(userId, quizId, score, totalQuestions) {
  // Placeholder for validation logic
  return (
    Number.isInteger(userId) &&
    Number.isInteger(quizId) &&
    Number.isInteger(score) &&
    Number.isInteger(totalQuestions) &&
    score >= 0 &&
    totalQuestions > 0 &&
    score <= totalQuestions
  );
}

app.get("/users/:userId", (req, res) => {
  const userId = req.params.userId;

  const query = `
      SELECT u.name, u.student_id, q.quiz_name, qr.score, qr.total_questions
      FROM Users u
      LEFT JOIN QuizResults qr ON u.user_id = qr.user_id
      LEFT JOIN Quizzes q ON qr.quiz_id = q.id
      WHERE u.user_id = ?
  `;

  connection.query(query, [userId], (error, results) => {
    if (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).send({ message: "Error fetching user profile", error });
    } else {
      const userProfile = {
        userInfo: results.length
          ? {
              name: results[0].name,
              studentId: results[0].student_id,
            }
          : {},
        quizResults: results.map((row) => ({
          quizName: row.quiz_name,
          score: row.score,
          totalQuestions: row.total_questions,
        })),
      };
      res.send(userProfile);
    }
  });
});

// Fetch all systems with their labels and drop zones
app.get("/anatomy", (req, res) => {
  const query = `
    SELECT sys.system_id, sys.name, sys.image_name, 
           lbl.label, dz.position_x, dz.position_y, dz.width, dz.height
    FROM AnatomySystems sys
    LEFT JOIN Labels lbl ON sys.system_id = lbl.system_id
    LEFT JOIN DropZones dz ON lbl.label_id = dz.label_id;
  `;

  connection.query(query, (error, results) => {
    if (error) {
      console.error("Error fetching systems for quiz:", error);
      return res.status(500).send({
        error: "Error fetching systems for quiz",
        details: error.message,
      });
    }

    console.log("Results:", results);

    // If there are no results, return an empty array
    if (results.length === 0) {
      return res.json([]);
    }

    // Process results to group labels and drop zones under their respective systems
    const systems = results.reduce((acc, row) => {
      // If the system is not yet in the accumulator, add it
      if (!acc[row.system_id]) {
        acc[row.system_id] = {
          system_id: row.system_id,
          name: row.name,
          image_name: row.image_name,
          labels: [],
          dropZones: [],
        };
      }

      // Add label and drop zone information
      if (row.label) {
        acc[row.system_id].labels.push(row.label);
        acc[row.system_id].dropZones.push({
          label: row.label,
          position_x: row.position_x,
          position_y: row.position_y,
          width: row.width,
          height: row.height,
        });
      }

      return acc;
    }, {});

    // Convert systems to an array
    const systemsArray = Object.values(systems);
    res.json(systemsArray);
  });
});

// Fetch specific system with labels and drop zones by system ID
app.get("/quiz/systems/:systemId", (req, res) => {
  const { systemId } = req.params;

  const query = `
    SELECT sys.name, sys.image_name, lbl.label, 
           dz.position_x, dz.position_y, dz.width, dz.height
    FROM AnatomySystems sys
    JOIN Labels lbl ON sys.system_id = lbl.system_id
    JOIN DropZones dz ON lbl.label_id = dz.label_id
    WHERE sys.system_id = ?;
  `;

  connection.query(query, [systemId], (error, results) => {
    if (error) {
      console.error("Error fetching specific system for quiz:", error);
      return res
        .status(500)
        .send({ error: "Error fetching specific system for quiz" });
    }

    // Process results to structure the JSON response
    const systemInfo =
      results.length > 0
        ? {
            name: results[0].name,
            image_name: results[0].image_name,
            labels: results.map((row) => row.label),
            dropZones: results.map((row) => ({
              label: row.label,
              position_x: row.position_x,
              position_y: row.position_y,
              width: row.width,
              height: row.height,
            })),
          }
        : {};

    res.json(systemInfo);
  });
});

// Ruta para crear un nuevo sistema
app.post("/systems", (req, res) => {
  const { name, modelName, description } = req.body;
  const query =
    "INSERT INTO systems (name, model_name, description) VALUES (?, ?, ?)";
  connection.query(query, [name, modelName, description], (error, results) => {
    if (error) throw error;
    res.send(`Sistema creado con ID: ${results.insertId}`);
  });
});

// Ruta para actualizar un sistema existente
app.put("/systems/:id", (req, res) => {
  const systemId = req.params.id;
  const { name, modelName, description } = req.body;
  const query =
    "UPDATE systems SET name = ?, model_name = ?, description = ? WHERE id = ?";
  connection.query(
    query,
    [name, modelName, description, systemId],
    (error, results) => {
      if (error) throw error;
      res.send(`Sistema con ID ${systemId} actualizado`);
    }
  );
});

// Ruta para eliminar un sistema
app.delete("/systems/:id", (req, res) => {
  const systemId = req.params.id;
  const query = "DELETE FROM systems WHERE id = ?";
  connection.query(query, [systemId], (error, results) => {
    if (error) throw error;
    res.send(`Sistema con ID ${systemId} eliminado`);
  });
});

// Ruta para crear una nueva pregunta
app.post("/questions", (req, res) => {
  const { systemId, difficulty, question } = req.body;
  const query =
    "INSERT INTO questions (system_id, difficulty, question) VALUES (?, ?, ?)";
  connection.query(
    query,
    [systemId, difficulty, question],
    (error, results) => {
      if (error) throw error;
      res.send(`Pregunta creada con ID: ${results.insertId}`);
    }
  );
});

// Ruta para crear una nueva respuesta
app.post("/answers", (req, res) => {
  const { questionId, answer, isCorrect } = req.body;
  const query =
    "INSERT INTO answers (question_id, answer, is_correct) VALUES (?, ?, ?)";
  connection.query(query, [questionId, answer, isCorrect], (error, results) => {
    if (error) throw error;
    res.send(`Respuesta creada con ID: ${results.insertId}`);
  });
});

// Iniciar el servidor
app.listen(3000, "0.0.0.0");
