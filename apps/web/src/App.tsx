import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { RouteFallback } from "@/ui";
import { RootBoundary } from "@/shell/RootBoundary";
import { RootLayout } from "@/shell/RootLayout";

/*
 * Every route is its own lazy chunk. That matters more here than in either
 * predecessor app: a visitor who only ever opens Captions should never download
 * Pixi and 495 template modules, and a visitor who only opens Motion should
 * never download transformers.js. The landing pulls neither.
 */
const Landing = lazy(() => import("./routes/Landing"));
const Captions = lazy(() => import("./routes/Captions"));
const Motion = lazy(() => import("./routes/Motion"));
const Projects = lazy(() => import("./routes/Projects"));
const Brand = lazy(() => import("./routes/Brand"));
const WhatsNew = lazy(() => import("./routes/WhatsNew"));
const Help = lazy(() => import("./routes/Help"));
const Privacy = lazy(() => import("./routes/Privacy"));
const Terms = lazy(() => import("./routes/Terms"));
const NotFound = lazy(() => import("./routes/NotFound"));

function route(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    // One layout route so the command palette and the saved brand kit are
    // mounted for every page, inside router context.
    element: <RootLayout />,
    children: [
      { path: "/", element: route(<Landing />) },
      { path: "/captions", element: route(<Captions />) },
      { path: "/motion", element: route(<Motion />) },
      { path: "/projects", element: route(<Projects />) },
      { path: "/brand", element: route(<Brand />) },
      { path: "/whats-new", element: route(<WhatsNew />) },
      { path: "/help", element: route(<Help />) },
      { path: "/privacy", element: route(<Privacy />) },
      { path: "/terms", element: route(<Terms />) },

      // Bookmarks from the two products' previous lives. `replace` keeps the
      // old URL out of the history stack, so Back goes where the user expects.
      { path: "/app", element: <Navigate to="/captions" replace /> },
      { path: "/studio", element: <Navigate to="/motion" replace /> },
      { path: "/news", element: <Navigate to="/whats-new" replace /> },

      { path: "*", element: route(<NotFound />) },
    ],
  },
]);

export function App() {
  return (
    <RootBoundary>
      <RouterProvider router={router} />
    </RootBoundary>
  );
}
