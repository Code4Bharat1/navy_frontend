'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, roleHome } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    router.replace(user ? roleHome(user.role) : '/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
