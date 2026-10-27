// Explicit ranges avoid PostgREST's default row cap hiding later practice records.
export async function collectRows<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 500,
): Promise<{ data: T[]; error: unknown }> {
  const data: T[] = [];
  for (let offset = 0; ; offset += size) {
    const page = await read(offset, offset + size - 1);
    if (page.error) return { data: [], error: page.error };
    if (!page.data)
      return { data: [], error: new Error("Missing account response") };
    data.push(...page.data);
    if (page.data.length < size) return { data, error: null };
  }
}
