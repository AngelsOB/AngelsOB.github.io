import RouteErrorPage from "../src/components/RouteErrorPage";

export default function NotFound() {
  return (
    <RouteErrorPage
      title="Page not found"
      message="The page you're looking for doesn't exist."
    />
  );
}
