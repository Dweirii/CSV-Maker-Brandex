import { Inngest } from "inngest"

export const inngest = new Inngest ({
    id: "csv-products-maker",
    eventKey: process.env.INNGEST_EVENT_KEY,
})