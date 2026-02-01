import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run expired reservation cleanup every 5 minutes
crons.interval(
  "release expired reservations",
  { minutes: 5 },
  internal.ledgerItems.releaseExpiredReservationsInternal
);

export default crons;
