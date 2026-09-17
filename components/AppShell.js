'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, logout } from '../lib/api';

const NAV_BY_ROLE = {
  super_admin: [
    { href: '/admin/staff', label: 'Staff & Cards', icon: '🪪' },
    { href: '/admin/shops', label: 'Shops', icon: '🏬' },
  ],
  shop_operator: [
    { href: '/shop/pos', label: 'Scan & Pay', icon: '📡' },
    { href: '/shop/dashboard', label: 'Dashboard', icon: '📊' },
  ],
  staff: [{ href: '/dashboard', label: 'My Wallet', icon: '💳' }],
  recharge_operator: [{ href: '/dashboard', label: 'My Wallet', icon: '💳' }],
};

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppShell({ title, subtitle, children, narrow }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const navItems = user ? NAV_BY_ROLE[user.role] || [] : [];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">⚓</div>
          <div className="brand-text">
            Navy Cashless
            <span>Camp Payment Platform</span>
          </div>
        </div>

        <div className="nav-group">
          <div className="nav-label">Menu</div>
          {navItems.map((item) => (
            <button
              key={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          {user && (
            <div className="user-chip">
              <div className="user-avatar">{initials(user.name)}</div>
              <div className="user-meta">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
          )}
          <button className="nav-link" onClick={handleLogout}>
            <span className="nav-icon">↩</span>
            Log out
          </button>
        </div>
      </aside>

      <div className="main">
        {title && (
          <div className="page-header">
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        )}
        <div className={`content ${narrow ? 'content-narrow' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
