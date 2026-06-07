import { DashboardFilter } from "./types"

export const FILTER_STATUS: Record<Exclude<DashboardFilter, "all">, number> = {
	available: 1,
	playing: 2
}

export const betOptions = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]

export const FILTER_KEYS: Record<DashboardFilter, string> = {
	all: "dashboard.filters.all",
	available: "dashboard.filters.available",
	playing: "dashboard.filters.playing"
}