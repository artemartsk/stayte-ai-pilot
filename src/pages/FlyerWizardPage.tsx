import React from 'react';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_EMAILS = new Set(['artemvitrimo@gmail.com']);

const FlyerWizardPage: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const isAdmin = !!user && ADMIN_EMAILS.has((user.email ?? '').toLowerCase());

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <p style={{ letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>Flyers</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
            Coming soon
          </h1>
          <p style={{ margin: 0, color: '#475467', lineHeight: 1.5 }}>
            US Letter flyer builder is in a private preview. Check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <p style={{ letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>Flyers</p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#0f172a' }}>
          Admin preview
        </h1>
        <p style={{ margin: 0, color: '#475467', lineHeight: 1.5 }}>
          Replace this placeholder with the flyer wizard when it’s ready.
        </p>
      </div>
    </div>
  );
};

export default FlyerWizardPage;
