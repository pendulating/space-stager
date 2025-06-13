#!/bin/bash

# NYC OpenData Downloader with Pagination Support
# Downloads dataset: https://data.cityofnewyork.us/resource/c5vm-g2dk.geojson
# Handles Socrata API pagination (max 50k rows per request)
# 
# IMPORTANT: This script requires bash, not sh
# Run with: bash script.sh or make executable and run ./script.sh

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Check if running with bash
if [ -z "${BASH_VERSION:-}" ]; then
    echo "ERROR: This script requires bash, not sh"
    echo "Please run with: bash $0"
    exit 1
fi

# Configuration
BASE_URL="https://data.cityofnewyork.us/resource/c5vm-g2dk.geojson"
LIMIT=50000  # Socrata supports up to 50k records per request
PARALLEL_JOBS=1  # Number of parallel downloads (set to 1 for sequential)
TEMP_DIR=$(mktemp -d)
BATCH_FILE_PREFIX="$TEMP_DIR/batch_"

# Date filter variables (will be set by command line args)
START_DATE=""
END_DATE=""
DATE_FILTER=""
FILTER_SUFFIX=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Simple URL encoding for the specific characters we need
simple_url_encode() {
    local string="$1"
    # Replace the problematic characters one by one
    string="${string// /%20}"        # spaces to %20
    string="${string//>=/%3E%3D}"    # >= to %3E%3D  
    string="${string//<=/%3C%3D}"    # <= to %3C%3D
    echo "$string"
}

# Function to show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Download NYC OpenData bkfu-528j dataset (Street Events) with optional date filtering.

OPTIONS:
    -s, --start-date DATE    Filter events starting on or after this date (YYYY-MM-DD format)
    -e, --end-date DATE      Filter events ending on or before this date (YYYY-MM-DD format)
    -j, --jobs NUM           Number of parallel download jobs (default: 4, set to 1 for sequential)
    -h, --help               Show this help message

EXAMPLES:
    # Download all events
    $0
    
    # Download events from 2024 only
    $0 --start-date 2024-01-01 --end-date 2024-12-31
    
    # Download events starting from June 2024
    $0 --start-date 2024-06-01
    
    # Download with sequential processing (if hitting rate limits)
    $0 --jobs 1 --start-date 2024-01-01

NOTES:
    - Dates should be in YYYY-MM-DD format (e.g., 2024-06-01)
    - Start date filters on 'start_date_time >= START_DATE'
    - End date filters on 'end_date_time <= END_DATE'
    - Both filters can be used together for a date range
    - Output file will include date range in filename when filters are used

EOF
}

# Function to validate date format - works on both Linux and macOS
validate_date() {
    local date_str=$1
    local field_name=$2
    
    # Check if date matches YYYY-MM-DD format
    if [[ ! $date_str =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        print_error "Invalid date format for $field_name: '$date_str'"
        print_error "Please use YYYY-MM-DD format (e.g., 2024-06-01)"
        exit 1
    fi
    
    # Extract year, month, day for validation
    local year=${date_str:0:4}
    local month=${date_str:5:2}
    local day=${date_str:8:2}
    
    # Basic range checks
    if [[ $month -lt 1 || $month -gt 12 ]]; then
        print_error "Invalid month for $field_name: '$month' (must be 01-12)"
        exit 1
    fi
    
    if [[ $day -lt 1 || $day -gt 31 ]]; then
        print_error "Invalid day for $field_name: '$day' (must be 01-31)"
        exit 1
    fi
    
    # Try to parse the date - with cross-platform compatibility
    local date_check_result
    if date --version >/dev/null 2>&1; then
        # GNU date (Linux)
        date_check_result=$(date -d "$date_str" >/dev/null 2>&1; echo $?)
    else
        # BSD date (macOS) - try different format
        date_check_result=$(date -j -f "%Y-%m-%d" "$date_str" >/dev/null 2>&1; echo $?)
    fi
    
    if [[ $date_check_result -ne 0 ]]; then
        print_error "Invalid date for $field_name: '$date_str'"
        print_error "Please ensure the date is valid (e.g., 2024-02-30 is not valid)"
        exit 1
    fi
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--start-date)
                START_DATE="$2"
                validate_date "$START_DATE" "start date"
                shift 2
                ;;
            -e|--end-date)
                END_DATE="$2"
                validate_date "$END_DATE" "end date"
                shift 2
                ;;
            -j|--jobs)
                PARALLEL_JOBS="$2"
                if [[ ! $PARALLEL_JOBS =~ ^[0-9]+$ ]] || [ "$PARALLEL_JOBS" -lt 1 ]; then
                    print_error "Invalid number of jobs: '$PARALLEL_JOBS'"
                    print_error "Please specify a positive integer"
                    exit 1
                fi
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Build date filter and filename suffix
    build_date_filter
}

# Function to build SoQL date filter
# Function to build SoQL date filter with proper URL encoding
build_date_filter() {
    local filter_parts=()
    
    if [ -n "$START_DATE" ]; then
        filter_parts+=("start_date_time >= '${START_DATE}'")
        FILTER_SUFFIX="${FILTER_SUFFIX}_from_${START_DATE}"
    fi
    
    if [ -n "$END_DATE" ]; then
        filter_parts+=("end_date_time <= '${END_DATE}'")
        FILTER_SUFFIX="${FILTER_SUFFIX}_to_${END_DATE}"
    fi
    
    if [ ${#filter_parts[@]} -gt 0 ]; then
        # Manually build the filter with proper AND joining
        local raw_filter
        if [ ${#filter_parts[@]} -eq 1 ]; then
            raw_filter="${filter_parts[0]}"
        else
            raw_filter="${filter_parts[0]} AND ${filter_parts[1]}"
        fi
        
        # URL encode the filter part
        local encoded_filter
        encoded_filter=$(simple_url_encode "$raw_filter")
        DATE_FILTER="\$where=${encoded_filter}"
    fi
    
    # Debug: print both versions
    if [ -n "$DATE_FILTER" ]; then
        print_status "Raw filter: $raw_filter"
        print_status "Encoded filter: $DATE_FILTER"
    fi
    
    # Set output filename with date filter suffix
    OUTPUT_FILE="nyc${FILTER_SUFFIX}_$(date +%Y%m%d_%H%M%S).geojson"
}

# Function to cleanup temp files
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Function to check if required tools are available
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_error "Please install them and try again."
        exit 1
    fi
}

# Function to get total record count - fixed parsing
get_total_count() {
    local count_url="${BASE_URL}?\$select=count(*)"
    
    # Add date filter if specified
    if [ -n "$DATE_FILTER" ]; then
        count_url="${count_url}&${DATE_FILTER}"
    fi
    
    print_status "Count URL: $count_url"
    
    local response
    response=$(curl -s --fail "$count_url" 2>/dev/null || {
        print_warning "Count API request failed"
        echo "unknown"
        return
    })
    
    print_status "Count API response: $response"
    
    # Extract count - handle the exact format we're seeing: [{"count":"4281612"}]
    local count
    count=$(echo "$response" | jq -r '.[0].count' 2>/dev/null)
    
    # Debug the extracted value
    print_status "Extracted count value: '$count'"
    
    # Simple validation - just check if it's a number
    if [[ "$count" =~ ^[0-9]+$ ]]; then
        print_success "Found total count: $count"
        echo "$count"
    else
        print_warning "Invalid count format: '$count'"
        echo "unknown"
    fi
}

# Function to download a batch of records
download_batch() {
    local offset=$1
    local batch_num=$2
    local batch_file="${BATCH_FILE_PREFIX}${batch_num}.json"
    
    local url="${BASE_URL}?\$limit=${LIMIT}&\$offset=${offset}"
    
    # Add date filter if specified
    if [ -n "$DATE_FILTER" ]; then
        url="${url}&${DATE_FILTER}"
    fi
    
    print_status "Downloading batch $batch_num (offset: $offset, limit: $LIMIT)..."
    
    if ! curl -s --fail "$url" -o "$batch_file"; then
        print_error "Failed to download batch $batch_num"
        return 1
    fi
    
    # Check if the batch file contains valid JSON and has records
    local record_count
    record_count=$(jq 'length' "$batch_file" 2>/dev/null || echo "0")
    
    if [ "$record_count" -eq 0 ]; then
        rm -f "$batch_file"
        return 2  # No more records
    fi
    
    print_success "Downloaded $record_count records in batch $batch_num"
    echo "$record_count"
}

# Function to download batches in parallel
download_batches_parallel() {
    local total_count=$1
    local estimated_batches=$(( (total_count + LIMIT - 1) / LIMIT ))
    
    print_status "Starting parallel download with $PARALLEL_JOBS concurrent jobs..."
    
    # Create job queue
    local job_queue=()
    for ((i=0; i<estimated_batches; i++)); do
        local offset=$((i * LIMIT))
        local batch_num=$((i + 1))
        job_queue+=("$offset:$batch_num")
    done
    
    # Function to process a single job
    process_job() {
        local job=$1
        local offset=${job%:*}
        local batch_num=${job#*:}
        
        download_batch_silent $offset $batch_num
    }
    
    # Export function so it's available to subshells
    export -f process_job download_batch_silent
    export BASE_URL LIMIT BATCH_FILE_PREFIX DATE_FILTER
    
    # Run jobs in parallel using GNU parallel or xargs
    if command -v parallel &> /dev/null; then
        printf '%s\n' "${job_queue[@]}" | parallel -j$PARALLEL_JOBS process_job
    else
        # Fallback to xargs if parallel is not available
        printf '%s\n' "${job_queue[@]}" | xargs -n1 -P$PARALLEL_JOBS -I{} bash -c 'process_job "$@"' _ {}
    fi
}

# Silent version of download_batch for parallel processing
download_batch_silent() {
    local offset=$1
    local batch_num=$2
    local batch_file="${BATCH_FILE_PREFIX}${batch_num}.json"
    
    local url="${BASE_URL}?\$limit=${LIMIT}&\$offset=${offset}"
    
    # Add date filter if specified
    if [ -n "$DATE_FILTER" ]; then
        url="${url}&${DATE_FILTER}"
    fi
    
    if ! curl -s --fail "$url" -o "$batch_file" 2>/dev/null; then
        echo "ERROR: Failed to download batch $batch_num" >&2
        return 1
    fi
    
    # Check if the batch file contains valid JSON and has records
    local record_count
    record_count=$(jq 'length' "$batch_file" 2>/dev/null || echo "0")
    
    if [ "$record_count" -eq 0 ]; then
        rm -f "$batch_file"
        return 2  # No more records
    fi
    
    echo "Batch $batch_num: $record_count records" >&2
    return 0
}

# Function to merge all batch files into final output
merge_batches() {
    print_status "Merging all batches into final output file: $OUTPUT_FILE"
    
    local batch_files=("$TEMP_DIR"/batch_*.json)
    
    if [ ${#batch_files[@]} -eq 0 ] || [ ! -f "${batch_files[0]}" ]; then
        print_error "No batch files found to merge"
        exit 1
    fi
    
    print_status "Found ${#batch_files[@]} batch files to merge"
    
    # Single jq command to merge all files - MUCH faster!
    if ! jq -s 'add' "${batch_files[@]}" > "$OUTPUT_FILE"; then
        print_error "Failed to merge batch files"
        exit 1
    fi
    
    local total_records
    total_records=$(jq 'length' "$OUTPUT_FILE")
    print_success "Final output contains $total_records records"
}

# Main execution
main() {
    # Parse command line arguments first
    parse_arguments "$@"
    
    print_status "Starting NYC OpenData download..."
    print_status "Dataset: bkfu-528j (Street Events)"
    
    # Show date filter information if applied
    if [ -n "$START_DATE" ] || [ -n "$END_DATE" ]; then
        print_status "Date Filters Applied:"
        [ -n "$START_DATE" ] && print_status "  - Events starting on or after: $START_DATE"
        [ -n "$END_DATE" ] && print_status "  - Events ending on or before: $END_DATE"
    else
        print_status "Date Filters: None (downloading all events)"
    fi
    
    print_status "Output file: $OUTPUT_FILE"
    print_status "Parallel jobs: $PARALLEL_JOBS"
    
    # Check dependencies
    check_dependencies
    
    # Get total count (if possible)
    print_status "Getting total record count..."
    local total_count
    total_count=$(get_total_count)
    
    if [ "$total_count" != "unknown" ]; then
        print_status "Total records to download: $total_count"
        local estimated_batches=$(( (total_count + LIMIT - 1) / LIMIT ))
        print_status "Estimated batches: $estimated_batches"
    else
        print_warning "Could not determine total count, will download until no more records"
    fi
    
    # Download batches
    if [ "$total_count" != "unknown" ] && [ "$PARALLEL_JOBS" -gt 1 ]; then
        # Use parallel downloads when we know the total count
        download_batches_parallel "$total_count"
        
        # Count total downloaded records
        local total_downloaded=0
        for batch_file in "$TEMP_DIR"/batch_*.json; do
            if [ -f "$batch_file" ]; then
                local count=$(jq 'length' "$batch_file" 2>/dev/null || echo "0")
                total_downloaded=$((total_downloaded + count))
            fi
        done
        
        print_success "Parallel download completed!"
        print_success "Total records downloaded: $total_downloaded"
    else
        # Use sequential downloads (original method)
        print_status "Using sequential downloads..."
        local offset=0
        local batch_num=1
        local total_downloaded=0
        
        while true; do
            local records_in_batch
            records_in_batch=$(download_batch $offset $batch_num)
            local exit_code=$?
            
            if [ $exit_code -eq 2 ]; then
                print_status "No more records available. Download complete."
                break
            elif [ $exit_code -ne 0 ]; then
                print_error "Failed to download batch $batch_num"
                exit 1
            fi
            
            total_downloaded=$((total_downloaded + records_in_batch))
            
            if [ "$total_count" != "unknown" ]; then
                local progress=$((total_downloaded * 100 / total_count))
                print_status "Progress: $total_downloaded/$total_count records ($progress%)"
            else
                print_status "Downloaded: $total_downloaded records so far"
            fi
            
            # Check if we got fewer records than the limit (indicates last batch)
            if [ "$records_in_batch" -lt "$LIMIT" ]; then
                print_status "Last batch detected (fewer than $LIMIT records). Download complete."
                break
            fi
            
            # Prepare for next batch
            offset=$((offset + LIMIT))
            batch_num=$((batch_num + 1))
        done
        
        print_success "Sequential download completed!"
        print_success "Total records downloaded: $total_downloaded"
    fi
    
    # Merge all batches
    merge_batches
    
    print_success "Download completed successfully!"
    print_success "Output saved to: $OUTPUT_FILE"
    
    # Show file size
    local file_size
    if command -v du &> /dev/null; then
        file_size=$(du -h "$OUTPUT_FILE" | cut -f1)
        print_status "File size: $file_size"
    fi
}

# Run main function
main "$@"