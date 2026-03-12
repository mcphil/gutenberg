import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useParams } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import BookDetail from "./pages/BookDetail";
import Reader from "./pages/Reader";

function BookDetailRoute() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  if (!id) return <NotFound />;
  return <BookDetail bookId={id} />;
}

function ReaderRoute() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  if (!id) return <NotFound />;
  return <Reader bookId={id} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book/:id" component={BookDetailRoute} />
      <Route path="/read/:id" component={ReaderRoute} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
