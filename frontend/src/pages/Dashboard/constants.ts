import { DashboardFilter } from "./types"

export const FILTER_STATUS: Record<Exclude<DashboardFilter, "all">, number> = {
	available: 1,
	playing: 2
}

export const FILTER_KEYS: Record<DashboardFilter, string> = {
	all: "dashboard.filters.all",
	available: "dashboard.filters.available",
	playing: "dashboard.filters.playing"
}