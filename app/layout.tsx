import "./globals.css";
export const metadata = {
  title: "Gather • Catering",
  description: "Menus, memorable gatherings, and a simpler catering business.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
