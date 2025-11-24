import '../styles/globals.css';

export const metadata = {
  title: 'BRSR Dashboard',
  description: 'Prototype',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}