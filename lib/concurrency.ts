/**
 * Run multiple promise-returning functions with limited concurrency.
 * @param items Array of items to process
 * @param limit Max number of concurrent operations
 * @param fn Function to run for each item
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length)
    const executing: Promise<void>[] = []

    let index = 0

    for (const item of items) {
        const currentIndex = index++

        const p = Promise.resolve().then(() => fn(item, currentIndex))
            .then(
                (value) => {
                    results[currentIndex] = { status: "fulfilled", value }
                },
                (reason) => {
                    results[currentIndex] = { status: "rejected", reason }
                }
            )

        // Add to executing array
        const e: Promise<void> = p.then(() => {
            // Remove self from executing array when done
            executing.splice(executing.indexOf(e), 1)
        })

        executing.push(e)

        // If we reached the limit, wait for one to finish
        if (executing.length >= limit) {
            await Promise.race(executing)
        }
    }

    // Wait for the rest
    await Promise.all(executing)

    return results
}
