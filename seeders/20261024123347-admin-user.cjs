'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');

// Создаётся командой npx sequelize-cli seed:generate --name admin-user, затем переименовать в .cjs. Данные админа берутся из .env:

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    const email = (
      process.env.ADMIN_EMAIL || 'admin@example.com'
    ).toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      throw new Error('ADMIN_PASSWORD не задан в .env');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await queryInterface.bulkInsert('users', [
      {
        username: 'admin',
        email,
        password: hashedPassword,
        role: 'admin',
        mustChangePassword: false,
        createdAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    const email = (
      process.env.ADMIN_EMAIL || 'admin@example.com'
    ).toLowerCase();
    await queryInterface.bulkDelete('users', { email });
  },
};


// генерация seeders
// npx sequelize-cli migration:generate --name create-users
// Запуск:
// npx sequelize-cli db:seed:all