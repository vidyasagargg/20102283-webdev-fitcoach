import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field } from '../components/ui.jsx';

const RULES = [
  { test: (p) => p.length >= 10, text: '10+ characters' },
  { test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p), text: 'Upper and lower case' },
  { test: (p) => /\d/.test(p), text: 'A number' },
];

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const user = isLogin
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password);
      navigate(location.state?.from?.pathname ?? (user.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setErrors({ ...err.fields, _form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero" aria-hidden="true">
        <img src="/icon-512.png" alt="" width="72" height="72" />
        <h2>Your coach in your pocket</h2>
        <p>Log workouts, meals and water as they happen. Get honest daily feedback and a plan that adapts every week.</p>
        <ul>
          <li>Paste your gym notes and they are converted automatically</li>
          <li>Type what you ate and get calories, protein and fibre</li>
          <li>Track weight, tape measurements and lifts over time</li>
        </ul>
      </div>
      <main className="auth-card" id="main">
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{isLogin ? 'Sign in to continue your plan.' : 'It takes a minute to set up.'}</p>
        <form onSubmit={submit} noValidate>
          {!isLogin && <Field label="Name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" required />}
          <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" required />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
          />
          {!isLogin && (
            <ul className="pw-rules" aria-label="Password requirements">
              {RULES.map((r) => (
                <li key={r.text} className={r.test(form.password) ? 'ok' : ''}>
                  {r.text}
                </li>
              ))}
            </ul>
          )}
          {errors._form && !Object.keys(errors).some((k) => k !== '_form') && (
            <p className="form-error" role="alert">
              {errors._form}
            </p>
          )}
          <Button type="submit" busy={busy} className="btn-block">
            {isLogin ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="auth-switch">
          {isLogin ? (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
