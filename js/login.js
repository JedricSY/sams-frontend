(function () {
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const errorBanner = document.getElementById('errorBanner');

  if (SAMS_API.isLoggedIn()) {
    window.location.href = 'pages/dashboard.html';
    return;
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('visible');
  }

  function clearError() {
    errorBanner.classList.remove('visible');
    errorBanner.textContent = '';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const result = await SAMS_API.call('login', { username: username, password: password });

    btn.disabled = false;
    btn.textContent = 'Sign in';

    if (!result.success) {
      showError(result.error || 'Unable to sign in.');
      return;
    }

    SAMS_API.setToken(result.data.token);
    sessionStorage.setItem('sams_role', result.data.role);
    sessionStorage.setItem('sams_username', result.data.username);
    window.location.href = 'pages/dashboard.html';
  });
})();
