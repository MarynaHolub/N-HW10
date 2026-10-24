import express from 'express';
import User from '../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import authenticate from '../middlewares/authenticate.js';
import authorizeAdmin from '../middlewares/authorizeAdmin.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const router = express.Router(); // создаёт отдельный роутер для маршрутов, связанных с User

router.get('/', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'Fields username, email, password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Пользователь с таким именем уже существует',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin',
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
      message: 'Пользователь успешно зарегистрирован',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'Укажите email и пароль',
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (!existingUser) {
      return res.status(401).json({
        message: 'Неверный email или пароль', // не сообщаем что не найден пользователь
      });
    }

    // console.log('password:', typeof password);
    // console.log('existingUser.password:', typeof existingUser.password);
    // console.log('Хэш пароля:', existingUser.password);

    // Сравним введённый пароль с хэшированным паролем в массиве
    const isMatch = await bcrypt.compare(password, existingUser.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Неверный email или пароль',
      });
    }

    // генерируем токен
    const token = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email, // на практике конфиденциальные, секретные данные в полезной нагрузке не отправляем!
        role: existingUser.role,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );

    res.json({
      // Отправим токен клиенту
      token,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      message: 'Ошибка сервера при аутентификации',
    });
  }
});

router.get('/profile', authenticate, (req, res) => {
  res.json({ message: 'Профиль пользователя' });
});

// Изменение email
router.put('/update-email', authenticate, async (req, res, next) => {
  try {
    const { newEmail, password } = req.body ?? {};

    // 1. Проверяем входные данные
    if (
      typeof newEmail !== 'string' ||
      !newEmail.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'New email and current password are required',
      });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    // 2. Проверяем формат email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Некорректный формат email',
      });
    }

    // 3. Находим авторизованного пользователя
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'Пользователь не найден',
      });
    }

    // 4. Проверяем текущий пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Неверный текущий пароль',
      });
    }

    // 5. Проверяем уникальность нового email
    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Этот email уже используется',
      });
    }

    // 6. Обновляем email
    await user.update({
      email: normalizedEmail,
    });

    return res.status(200).json({
      message: 'Email успешно изменён',
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/delete-account', authenticate, async (req, res, next) => {
  // authenticate проверяет JWT и записывает пользователя в req.user
  try {
    const { password } = req.body ?? {};

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Введите текущий пароль',
      });
    }

    const user = await User.findByPk(req.user.id); // User.findByPk(req.user.id) находит аккаунт авторизованного пользователя

    if (!user) {
      return res.status(404).json({
        message: 'Пользователь не найден',
      });
    }

    const isPasswordValid = await bcrypt.compare(
      // сравнивает введённый пароль с хешем в базе данных
      password,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Неверный пароль',
      });
    }

    await user.destroy();

    return res.status(200).json({
      message: 'Аккаунт успешно удалён',
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/update-role',
  authenticate,
  authorizeAdmin,
  async (req, res, next) => {
    // authenticate - авторизация
    try {
      const { userId, newRole } = req.body ?? {};

      // 1. Проверяем входные данные
      const id = Number(userId);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
          message: 'Укажите корректный userId',
        });
      }

      const role = typeof newRole === 'string' ? newRole.trim() : '';

      const allowedRoles = ['user', 'admin'];

      if (!allowedRoles.includes(role.trim())) {
        return res.status(400).json({
          message: 'Недопустимая роль',
        });
      }

      const user = await User.findByPk(id);

      if (!user) {
        return res.status(404).json({
          message: 'Пользователь не найден',
        });
      }

      // в базу пишем уже очищенное значение
      await user.update({
        role: role,
      });

      res.json({
        message: 'Роль успешно изменена',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/refresh-token', authenticate, async (req, res, next) => {
  try {
    // 1. Находим пользователя по ID из проверенного токена
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'Пользователь не найден',
      });
    }

    // 2. Генерируем новый JWT
    const newToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      },
    );

    // 3. Возвращаем новый токен клиенту
    return res.status(200).json({
      message: 'Токен успешно обновлён',
      token: newToken,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
