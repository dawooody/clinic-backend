require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/models');

const PORT = process.env.PORT || 5000;

// Sync DB and start server
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // alter: true updates existing tables safely without dropping data
    await sequelize.sync({ alter: false });
    console.log('All models synced with database');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Mobile API ready at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
