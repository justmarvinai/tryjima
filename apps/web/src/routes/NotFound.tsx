import { Link } from "react-router-dom";
import { buttonClasses, cn, Container, Wordmark } from "@/ui";
import { PRODUCTS } from "@/shell/products";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-void px-5">
      <Container className="max-w-xl text-center">
        <Link to="/" aria-label="Jima home" className="inline-block rounded-lg">
          <Wordmark className="text-2xl" />
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-lime">404</p>
        <h1 className="headline-xl mt-3 text-4xl text-chalk sm:text-5xl">Nothing lives here.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          That page does not exist. The two that definitely do are below.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {PRODUCTS.map((p, i) => (
            <Link key={p.id} to={p.path} className={cn(buttonClasses(i === 0 ? "primary" : "secondary", "md"))}>
              Open {p.name}
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}
