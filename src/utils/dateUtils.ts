import { SDPDate } from '../api/types.js';

/**
 * Convert ISO date string to SDP date format
 * @param isoDate ISO date string (e.g., "2025-01-04T10:00:00Z")
 * @returns SDP date object with display value and epoch milliseconds
 */
export function toSDPDate(isoDate: string | Date): SDPDate {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  
  // SDP expects epoch milliseconds as string
  const epochMs = date.getTime().toString();
  
  // Format display value like SDP does
  const displayValue = formatDisplayDate(date);
  
  return {
    value: epochMs,
    display_value: displayValue,
  };
}

/**
 * Convert SDP date to ISO string
 * @param sdpDate SDP date object
 * @returns ISO date string
 */
export function fromSDPDate(sdpDate: SDPDate): string {
  const epochMs = parseInt(sdpDate.value, 10);
  return new Date(epochMs).toISOString();
}

/**
 * Convert SDP date to JavaScript Date object
 * @param sdpDate SDP date object
 * @returns JavaScript Date object
 */
export function sdpDateToDate(sdpDate: SDPDate): Date {
  const epochMs = parseInt(sdpDate.value, 10);
  return new Date(epochMs);
}

/**
 * Format date for display like SDP does
 * @param date JavaScript Date object
 * @returns Formatted display string (e.g., "Jan 4, 2025 10:00 AM")
 */
function formatDisplayDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  
  const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();
  
  return `${month} ${day}, ${year} ${hours}:${minutesStr} ${ampm}`;
}

/**
 * Check if a value is an SDP date object
 * @param value Value to check
 * @returns True if value is an SDP date object
 */
export function isSDPDate(value: any): value is SDPDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'display_value' in value &&
    typeof value.value === 'string' &&
    typeof value.display_value === 'string'
  );
}

/**
 * Convert date fields in an object to SDP format
 * @param obj Object with potential date fields
 * @param dateFields Array of field names that contain dates
 * @returns Object with converted date fields
 */
export function convertDateFields<T extends Record<string, any>>(
  obj: T,
  dateFields: string[]
): T {
  const result = { ...obj } as any;
  
  for (const field of dateFields) {
    if (field in result && result[field]) {
      // Handle nested fields (e.g., "actual_end_time.value")
      const parts = field.split('.');
      if (parts.length === 1) {
        // Simple field
        if (typeof result[field] === 'string' || result[field] instanceof Date) {
          result[field] = toSDPDate(result[field]);
        }
      } else {
        // Nested field
        let current: any = result;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        const lastPart = parts[parts.length - 1];
        if (typeof current[lastPart] === 'string' || current[lastPart] instanceof Date) {
          current[lastPart] = toSDPDate(current[lastPart]);
        }
      }
    }
  }
  
  return result as T;
}

/**
 * Get current time in SDP date format
 * @returns Current time as SDP date
 */
export function nowAsSDPDate(): SDPDate {
  return toSDPDate(new Date());
}

/**
 * Add duration to an SDP date
 * @param sdpDate Starting SDP date
 * @param duration Duration to add (e.g., { hours: 1, minutes: 30 })
 * @returns New SDP date
 */
export function addToSDPDate(
  sdpDate: SDPDate,
  duration: { 
    years?: number;
    months?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
  }
): SDPDate {
  const date = sdpDateToDate(sdpDate);
  
  if (duration.years) date.setFullYear(date.getFullYear() + duration.years);
  if (duration.months) date.setMonth(date.getMonth() + duration.months);
  if (duration.days) date.setDate(date.getDate() + duration.days);
  if (duration.hours) date.setHours(date.getHours() + duration.hours);
  if (duration.minutes) date.setMinutes(date.getMinutes() + duration.minutes);
  if (duration.seconds) date.setSeconds(date.getSeconds() + duration.seconds);
  
  return toSDPDate(date);
}