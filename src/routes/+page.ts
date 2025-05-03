import { loadGeoJSONData } from '$lib/utils/config';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	await loadGeoJSONData(fetch);
	
	return {
		title: 'IRA Tracker'
	};
};