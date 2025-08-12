export const metadata = {
  title: 'Balloon TD - Next.js',
  description: 'Bloons-like TD in Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: '#0b0f1a',
          color: '#e5e7eb',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
        }}
      >
        {children}
      </body>
    </html>
  );
}
