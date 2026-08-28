export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-center gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-fg">Iniciar sesión</h1>
      <form className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-fg-muted">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-fg-muted"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-md border border-border-input bg-background px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-fg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
