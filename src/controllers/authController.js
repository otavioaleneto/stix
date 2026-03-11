const { Admin } = require('../models');

exports.loginPage = (req, res) => {
  res.render('login', { title: 'Login', error: null });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] Login attempt: user="${username}" ip=${req.ip}`);

  try {
    let admin;
    try {
      admin = await Admin.findOne({ where: { username, active: true } });
    } catch (dbErr) {
      console.error('[AUTH] Database query failed during login:', dbErr.message);
      console.error('[AUTH] DB Error code:', dbErr.original?.code || 'N/A');
      console.error('[AUTH] DB Error errno:', dbErr.original?.errno || 'N/A');
      console.error('[AUTH] Full error:', dbErr.stack);

      let errorMsg = 'Erro de conexao com o banco de dados.';
      const msg = dbErr.message || '';
      if (msg.includes('ECONNREFUSED')) {
        errorMsg = 'Banco de dados recusou a conexao. Verifique se o MySQL/PostgreSQL esta rodando e as configuracoes de host/porta no .env';
      } else if (msg.includes('ER_ACCESS_DENIED') || msg.includes('authentication failed')) {
        errorMsg = 'Acesso negado ao banco de dados. Verifique DB_USER e DB_PASS no .env';
      } else if (msg.includes('ETIMEDOUT')) {
        errorMsg = 'Timeout ao conectar no banco. Verifique DB_HOST e DB_PORT no .env';
      } else if (msg.includes('ER_NO_SUCH_TABLE') || msg.includes('relation') && msg.includes('does not exist')) {
        errorMsg = 'Tabela "admins" nao encontrada. Execute o wizard de instalacao em /install';
      } else if (msg.includes('ER_BAD_DB_ERROR') || msg.includes('database') && msg.includes('does not exist')) {
        errorMsg = 'Banco de dados nao encontrado. Verifique DB_NAME no .env';
      } else {
        errorMsg = 'Erro no banco de dados: ' + msg;
      }

      return res.render('login', { title: 'Login', error: errorMsg });
    }

    if (!admin) {
      console.log(`[AUTH] Login failed: user "${username}" not found or inactive`);
      return res.render('login', {
        title: 'Login',
        error: 'Usuario ou senha invalidos'
      });
    }

    const passwordValid = await admin.checkPassword(password);
    if (!passwordValid) {
      console.log(`[AUTH] Login failed: wrong password for user "${username}"`);
      return res.render('login', {
        title: 'Login',
        error: 'Usuario ou senha invalidos'
      });
    }

    console.log(`[AUTH] Login success: user="${username}" role=${admin.role} id=${admin.id}`);

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    req.session.adminEmail = admin.email;
    req.session.adminRole = admin.role;

    req.session.save((err) => {
      if (err) {
        console.error('[AUTH] Session save error:', err.message);
        console.error('[AUTH] Session save stack:', err.stack);

        let sessionError = 'Erro ao salvar sessao.';
        const msg = err.message || '';
        if (msg.includes('ECONNREFUSED')) {
          sessionError = 'Banco de dados desconectado. A sessao nao pode ser salva. Reinicie o servidor.';
        } else if (msg.includes('ER_NO_SUCH_TABLE') || msg.includes('Sessions') || msg.includes('sessions')) {
          sessionError = 'Tabela de sessoes nao encontrada. Reinicie o servidor para recria-la.';
        } else {
          sessionError = 'Erro ao salvar sessao: ' + msg;
        }

        return res.render('login', { title: 'Login', error: sessionError });
      }

      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      console.log(`[AUTH] Session saved, redirecting to ${returnTo}`);
      res.redirect(returnTo);
    });
  } catch (error) {
    console.error('[AUTH] Unexpected login error:', error.message);
    console.error('[AUTH] Stack:', error.stack);
    res.render('login', { title: 'Login', error: 'Erro inesperado: ' + error.message });
  }
};

exports.logout = (req, res) => {
  const user = req.session.adminUsername || 'unknown';
  req.session.destroy(() => {
    console.log(`[AUTH] Logout: user="${user}"`);
    res.redirect('/login');
  });
};
