<script lang="ts">
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';
	import { 
		dataStore, 
		isDataLoading, 
		filteredResults as globalFilteredResults,
		districtState
	} from '$lib/stores';
	import type { Project } from '$lib/types';
	import DistrictResultsTable from '$lib/components/search/DistrictResultsTable.svelte';

	// Derived store for districts data
	const districts = derived(
		[dataStore],
		([$dataStore]) => {
			if ($dataStore.isLoading) return [];
			
			const districtsMap = new Map<string, { state: string, district: string }>();
			
			// Extract all districts from projects
			$dataStore.collection.collection.features.forEach(f => {
				const props = f.properties || {};
				const congressionalDistrict = props['118th CD'] || '';
				const state = props.State || '';
				
				if (congressionalDistrict && state) {
					const key = `${state}-${congressionalDistrict}`;
					districtsMap.set(key, { state, district: congressionalDistrict });
				}
			});
			
			// Sort districts by state, then by district
			return Array.from(districtsMap.values())
				.sort((a, b) => {
					if (a.state !== b.state) return a.state.localeCompare(b.state);
					
					// Extract district numbers for correct numerical sorting
					const aNum = parseInt(a.district.replace(/\D/g, ''), 10);
					const bNum = parseInt(b.district.replace(/\D/g, ''), 10);
					return aNum - bNum;
				})
				.map(d => ({
					value: `${d.state}-${d.district}`,
					label: d.district
				}));
		}
	);

	// Derived store for states data
	const states = derived(
		[dataStore],
		([$dataStore]) => {
			if ($dataStore.isLoading) return [];
			
			const statesSet = new Set<string>();
			
			// Extract all states from projects
			$dataStore.collection.collection.features.forEach(f => {
				const props = f.properties || {};
				const state = props.State || '';
				
				if (state) {
					statesSet.add(state);
				}
			});
			
			// Sort states alphabetically
			return Array.from(statesSet)
				.sort()
				.map(s => ({
					value: s,
					label: s
				}));
		}
	);

	// First, let's create a derived store for funding sources
	const fundingSources = derived(
		[dataStore],
		([$dataStore]) => {
			if ($dataStore.isLoading) return [];
			
			const sourcesSet = new Set<string>();
			
			// Extract all funding sources from projects
			$dataStore.collection.collection.features.forEach(f => {
				const props = f.properties || {};
				const fundingSource = props['Funding Source'] || '';
				
				if (fundingSource) {
					sourcesSet.add(fundingSource);
				}
			});
			
			// Sort funding sources alphabetically
			return Array.from(sourcesSet)
				.sort()
				.map(s => ({
					value: s,
					label: s
				}));
		}
	);

	// Filtered results based on district/state selection
	const filteredByDistrict = derived(
		[globalFilteredResults, districtState],
		([$filteredResults, $districtState]) => {
			let results = $filteredResults;
			
			// Debug logging
			console.log('Filtering with state:', $districtState.stateCode, 
						'district:', $districtState.district,
						'funding source:', $districtState.fundingSource);
			
			// Apply all filters that are set
			if ($districtState.fundingSource) {
				results = results.filter(project => project.fundingSource === $districtState.fundingSource);
			}
			
			if ($districtState.district && $districtState.stateCode) {
				results = results.filter(project => {
					const match = project.state === $districtState.stateCode && 
								 project.congressionalDistrict === $districtState.district;
					return match;
				});
			}
			else if ($districtState.stateCode) {
				results = results.filter(project => project.state === $districtState.stateCode);
			}
			
			console.log('Filtered results count:', results.length);
			return results;
		}
	);

	// Handle district selection
	function handleDistrictChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		
		districtState.update(state => {
			if (select.value) {
				// The value format is "Alabama-AL-01" or similar
				// We need to extract the state code and district code correctly
				const parts = select.value.split('-');
				const stateCode = parts[0]; // This is the state code like "Alabama"
				const district = parts.slice(1).join('-'); // This rejoins anything after the first hyphen
				return { ...state, district, stateCode, isFiltering: true };
			} else {
				return { ...state, district: '', isFiltering: true };
			}
		});
		
		// Reset filtering flag after brief delay to show loading state
		setTimeout(() => {
			districtState.update(state => ({ ...state, isFiltering: false }));
		}, 300);
	}

	// Handle state selection
	function handleStateChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		
		districtState.update(state => {
			const newState = select.value;
			// Clear district and funding source if state changes or is cleared
			const newDistrict = (newState && newState === state.stateCode) ? state.district : '';
			const newFundingSource = (newState && newState === state.stateCode) ? state.fundingSource : '';
			
			return { 
				...state, 
				stateCode: newState, 
				district: newDistrict,
				fundingSource: newFundingSource,
				isFiltering: true 
			};
		});
		
		// Reset filtering flag after brief delay to show loading state
		setTimeout(() => {
			districtState.update(state => ({ ...state, isFiltering: false }));
		}, 300);
	}

	// Add handler for funding source changes
	function handleFundingSourceChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		
		districtState.update(state => {
			return { 
				...state, 
				fundingSource: select.value,
				isFiltering: true 
			};
		});
		
		// Reset filtering flag after brief delay to show loading state
		setTimeout(() => {
			districtState.update(state => ({ ...state, isFiltering: false }));
		}, 300);
	}

	// Update clearFilters to also clear funding source
	function clearFilters() {
		districtState.update(state => ({
			...state,
			stateCode: '',
			district: '',
			fundingSource: '',
			isFiltering: true
		}));
		
		// Reset filtering flag after brief delay to show loading state
		setTimeout(() => {
			districtState.update(state => ({ ...state, isFiltering: false }));
		}, 300);
	}

	// Check for URL parameters and set initial state
	onMount(() => {
		const url = new URL(window.location.href);
		const urlStateCode = url.searchParams.get('state');
		const urlDistrict = url.searchParams.get('district');
		
		if (urlStateCode) {
			districtState.update(state => ({
				...state,
				stateCode: urlStateCode,
				district: urlDistrict || '',
				isFiltering: true
			}));
			
			setTimeout(() => {
				districtState.update(state => ({ ...state, isFiltering: false }));
			}, 300);
		}
	});

	// Update URL when filters change
	$: {
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			
			if ($districtState.stateCode) {
				url.searchParams.set('state', $districtState.stateCode);
			} else {
				url.searchParams.delete('state');
			}
			
			if ($districtState.district) {
				url.searchParams.set('district', $districtState.district);
			} else {
				url.searchParams.delete('district');
			}
			
			window.history.replaceState({}, '', url.toString());
		}
	}

	// Available districts for currently selected state
	$: stateDistricts = $districts.filter(d => 
		$districtState.stateCode ? d.value.startsWith($districtState.stateCode + '-') : true
	);

	// Current district selection value for binding to select
	$: currentDistrictValue = $districtState.stateCode && $districtState.district 
		? `${$districtState.stateCode}-${$districtState.district}` 
		: '';

	// Page title with count
	$: pageTitle = $districtState.district 
		? `Projects in ${$districtState.stateCode}-${$districtState.district} (${$filteredByDistrict.length})`
		: $districtState.stateCode
			? `Projects in ${$districtState.stateCode} (${$filteredByDistrict.length})`
			: `All Projects (${$filteredByDistrict.length})`;

	// First, let's add a function to handle the CSV export
	function exportToCsv() {
		// Create and dispatch a custom event that will be caught by the DistrictResultsTable component
		const event = new CustomEvent('downloadcsv');
		window.dispatchEvent(event);
	}
</script>

<svelte:head>
	<title>IRA Tracker - Congressional Districts</title>
</svelte:head>

<div class="container mx-auto py-4 font-['Basis_Grotesque']">
	<div class="mb-6">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-slate-800 font-['PolySans']">{pageTitle}</h1>
			<a href="/" class="text-emerald-600 hover:text-emerald-700 hover:underline text-sm">Back to Map</a>
		</div>
		<p class="text-sm text-slate-600 mt-1">Filter projects by congressional district or state</p>
	</div>

	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<!-- State Filter -->
			<div>
				<label for="state-filter" class="block text-sm font-medium text-slate-700 mb-1">
					State
				</label>
				<select
					id="state-filter"
					class="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
					on:change={handleStateChange}
					value={$districtState.stateCode}
				>
					<option value="">All States</option>
					{#each $states as state}
						<option value={state.value}>{state.label}</option>
					{/each}
				</select>
			</div>

			<!-- District Filter -->
			<div>
				<label for="district-filter" class="block text-sm font-medium text-slate-700 mb-1">
					Congressional District
				</label>
				<select
					id="district-filter"
					class="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
					on:change={handleDistrictChange}
					value={currentDistrictValue}
					disabled={!$districtState.stateCode}
				>
					<option value="">All Districts</option>
					{#each stateDistricts as district}
						<option value={district.value}>{district.label}</option>
					{/each}
				</select>
			</div>

			<!-- Funding Source Filter -->
			<div>
				<label for="funding-filter" class="block text-sm font-medium text-slate-700 mb-1">
					Funding Source
				</label>
				<select
					id="funding-filter"
					class="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
					on:change={handleFundingSourceChange}
					value={$districtState.fundingSource || ''}
					disabled={!$districtState.stateCode}
				>
					<option value="">All Sources</option>
					{#each $fundingSources as source}
						<option value={source.value}>{source.label}</option>
					{/each}
				</select>
			</div>

			<!-- Clear Filters Button -->
			<div class="flex items-end gap-4">
				<button
					type="button"
					class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
					on:click={clearFilters}
				>
					Clear Filters
				</button>
				
				<button
					type="button"
					on:click={exportToCsv}
					disabled={$isDataLoading || $districtState.isFiltering || $filteredByDistrict.length === 0}
					class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5"
				>
					<svg
						class="h-4 w-4 flex-shrink-0"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						/>
					</svg>
					Download CSV
				</button>
			</div>
		</div>
	</div>

	<!-- Results Table -->
	<div class="bg-white shadow rounded-lg overflow-hidden">
		{#if $isDataLoading}
			<div class="p-6 flex justify-center">
				<div class="flex items-center gap-3">
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
					<p class="text-sm text-slate-500">Loading project data...</p>
				</div>
			</div>
		{:else if $filteredByDistrict.length === 0}
			<div class="p-6 text-center">
				<p class="text-slate-600">No projects found for the selected filters.</p>
			</div>
		{:else}
			<!-- Use our custom DistrictResultsTable component -->
			<DistrictResultsTable projects={$filteredByDistrict} />
		{/if}
	</div>
</div>

<style>
	/* Add any additional styles here */
</style>