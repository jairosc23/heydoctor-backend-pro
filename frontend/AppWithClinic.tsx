'use client';

import React from 'react';
import { ClinicProvider } from './context';

/**
 * Root app wrapper with ClinicProvider.
 * Use in your root layout:
 *
 * // app/layout.tsx or pages/_app.tsx
 * import { ClinicProvider } from './context';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ClinicProvider>
 *           {children}
 *         </ClinicProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function AppWithClinic({ children }: { children: React.ReactNode }) {
  return <ClinicProvider>{children}</ClinicProvider>;
}
