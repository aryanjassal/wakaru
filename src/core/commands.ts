export type CoreCommand<Context> = Readonly<{
  id: string;
  title: string;
  run: (context: Context) => void | Promise<void>;
}>;

export class CoreCommandRegistry<
  Context,
  Command extends CoreCommand<Context> = CoreCommand<Context>,
> {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  get(commandId: string): Command | null {
    return this.commands.get(commandId) ?? null;
  }

  list(): readonly Command[] {
    return [...this.commands.values()];
  }

  async run(commandId: string, context: Context): Promise<boolean> {
    const command = this.get(commandId);
    if (!command) return false;
    await command.run(context);
    return true;
  }
}
