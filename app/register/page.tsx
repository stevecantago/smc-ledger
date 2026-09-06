import { redirect } from 'next/navigation';
import { isPublicRegistrationEnabled } from '../../src/lib/authFlow';

export default function RegisterPage() {
  if (!isPublicRegistrationEnabled()) {
    redirect('/login');
  }

  redirect('/login');
}
