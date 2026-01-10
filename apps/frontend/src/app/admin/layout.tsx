export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Dodać guard sprawdzający czy użytkownik jest adminem
  // Jeśli nie jest adminem, przekierować do /dashboard

  return <>{children}</>;
}
