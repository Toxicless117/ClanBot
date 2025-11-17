import mysqlPool from "./mysqlConnection";

// (Limpieza) Eliminado esquema SQLite en desuso

const initializeDatabase = async () => {
  console.log("[DEBUG] Inicializando base de datos MySQL...");

  const connection = await mysqlPool.getConnection();

  try {
    // Crear tabla Clanes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Clanes (
        ID_Clan INT AUTO_INCREMENT PRIMARY KEY,
        Nombre_Clan VARCHAR(255) NOT NULL UNIQUE,
        Lider_Clan_ID BIGINT NOT NULL,
        Colider_Clan_ID BIGINT NULL,
        Poder_Clan INT DEFAULT 0,
        Miembros_Clan JSON,
        Fecha_Creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Crear tabla Usuarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Usuarios (
        ID_Usuario BIGINT PRIMARY KEY,
        Nombre_Usuario VARCHAR(255) NOT NULL,
        ID_Clan INT NULL,
        Nivel INT DEFAULT 1,
        XP INT DEFAULT 0,
        Racha INT DEFAULT 0,
        Multiplicador_Racha FLOAT DEFAULT 1.0,
        Poder_Usuario INT DEFAULT 0,
        Logros_Usuario JSON,
        FOREIGN KEY (ID_Clan) REFERENCES Clanes(ID_Clan) ON DELETE SET NULL
      );
    `);

    // Crear tabla Eastereggs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Eastereggs (
        Codigo_Easteregg VARCHAR(255) PRIMARY KEY,
        Lista_Respuestas JSON NOT NULL
      );
    `);

    // Crear tabla Eastereggs_Reclamados
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Eastereggs_Reclamados (
        ID_Registro INT AUTO_INCREMENT PRIMARY KEY,
        ID_Usuario BIGINT NOT NULL,
        Codigo_Easteregg VARCHAR(255) NOT NULL,
        Fecha_Reclamado DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ID_Usuario) REFERENCES Usuarios(ID_Usuario) ON DELETE CASCADE,
        FOREIGN KEY (Codigo_Easteregg) REFERENCES Eastereggs(Codigo_Easteregg) ON DELETE CASCADE
      );
    `);

    console.log("[DEBUG] Tablas verificadas/creadas correctamente.");
  } finally {
    connection.release();
  }
};

export default initializeDatabase;