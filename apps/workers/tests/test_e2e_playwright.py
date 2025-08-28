import pytest
import asyncio
from playwright.async_api import async_playwright, Page, Browser
import time
import os

@pytest.fixture(scope="session")
async def browser():
    """Create browser instance for E2E tests"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        yield browser
        await browser.close()

@pytest.fixture
async def page(browser: Browser):
    """Create page instance for each test"""
    page = await browser.new_page()
    yield page
    await page.close()

@pytest.mark.asyncio
async def test_create_project_workflow(page: Page):
    """Test complete project creation workflow"""
    # Navigate to the application
    await page.goto("http://localhost:3000")
    
    # Wait for page to load
    await page.wait_for_load_state("networkidle")
    
    # Check if we're on the dashboard
    await page.wait_for_selector("text=Dashboard", timeout=10000)
    
    # Navigate to projects page
    await page.click("text=Projects")
    await page.wait_for_selector("text=Create Project", timeout=5000)
    
    # Create a new project
    await page.click("text=Create Project")
    await page.wait_for_selector("[data-testid='project-form']", timeout=5000)
    
    # Fill project details
    await page.fill("[data-testid='project-name']", "E2E Test Project")
    await page.fill("[data-testid='project-description']", "Test project for E2E testing")
    
    # Submit the form
    await page.click("text=Create")
    
    # Wait for project to be created
    await page.wait_for_selector("text=E2E Test Project", timeout=10000)
    
    # Verify project was created
    project_element = await page.query_selector("text=E2E Test Project")
    assert project_element is not None

@pytest.mark.asyncio
async def test_add_seeds_workflow(page: Page):
    """Test adding seeds to a project"""
    # Navigate to projects page
    await page.goto("http://localhost:3000/projects")
    await page.wait_for_load_state("networkidle")
    
    # Click on the first project (or create one if none exists)
    try:
        await page.click("[data-testid='project-item']", timeout=5000)
    except:
        # Create a project if none exists
        await page.click("text=Create Project")
        await page.fill("[data-testid='project-name']", "E2E Seeds Test")
        await page.fill("[data-testid='project-description']", "Test project for seeds")
        await page.click("text=Create")
        await page.wait_for_selector("text=E2E Seeds Test", timeout=10000)
        await page.click("text=E2E Seeds Test")
    
    # Navigate to seeds section
    await page.wait_for_selector("text=Seeds", timeout=5000)
    await page.click("text=Seeds")
    
    # Add a new seed
    await page.click("text=Add Seed")
    await page.wait_for_selector("[data-testid='seed-form']", timeout=5000)
    
    # Fill seed details
    await page.fill("[data-testid='seed-keyword']", "digital marketing")
    await page.select_option("[data-testid='seed-type']", "keyword")
    
    # Submit the form
    await page.click("text=Add")
    
    # Wait for seed to be added
    await page.wait_for_selector("text=digital marketing", timeout=10000)
    
    # Verify seed was added
    seed_element = await page.query_selector("text=digital marketing")
    assert seed_element is not None

@pytest.mark.asyncio
async def test_keyword_expansion_workflow(page: Page):
    """Test keyword expansion workflow"""
    # Navigate to a project with seeds
    await page.goto("http://localhost:3000/projects")
    await page.wait_for_load_state("networkidle")
    
    # Click on a project
    await page.click("[data-testid='project-item']", timeout=5000)
    
    # Navigate to seeds
    await page.click("text=Seeds")
    await page.wait_for_selector("[data-testid='seed-item']", timeout=5000)
    
    # Click on expand button for a seed
    await page.click("[data-testid='expand-seed']")
    
    # Wait for expansion to start
    await page.wait_for_selector("text=Expanding", timeout=5000)
    
    # Wait for expansion to complete (with timeout)
    try:
        await page.wait_for_selector("text=Expansion Complete", timeout=30000)
    except:
        # Check if keywords were generated
        await page.wait_for_selector("[data-testid='keyword-item']", timeout=10000)
    
    # Verify keywords were generated
    keywords = await page.query_selector_all("[data-testid='keyword-item']")
    assert len(keywords) > 0

@pytest.mark.asyncio
async def test_keyword_clustering_workflow(page: Page):
    """Test keyword clustering workflow"""
    # Navigate to keywords page
    await page.goto("http://localhost:3000/keywords")
    await page.wait_for_load_state("networkidle")
    
    # Wait for keywords to load
    await page.wait_for_selector("[data-testid='keyword-item']", timeout=10000)
    
    # Click on cluster button
    await page.click("text=Cluster Keywords")
    
    # Wait for clustering to start
    await page.wait_for_selector("text=Clustering", timeout=5000)
    
    # Wait for clustering to complete
    try:
        await page.wait_for_selector("text=Clustering Complete", timeout=30000)
    except:
        # Check if clusters were created
        await page.wait_for_selector("[data-testid='cluster-item']", timeout=15000)
    
    # Verify clusters were created
    clusters = await page.query_selector_all("[data-testid='cluster-item']")
    assert len(clusters) > 0

@pytest.mark.asyncio
async def test_content_brief_generation(page: Page):
    """Test content brief generation"""
    # Navigate to content briefs page
    await page.goto("http://localhost:3000/briefs")
    await page.wait_for_load_state("networkidle")
    
    # Click on generate brief
    await page.click("text=Generate Brief")
    await page.wait_for_selector("[data-testid='brief-form']", timeout=5000)
    
    # Fill brief details
    await page.fill("[data-testid='brief-topic']", "SEO Best Practices")
    await page.select_option("[data-testid='brief-type']", "how-to")
    
    # Submit the form
    await page.click("text=Generate")
    
    # Wait for brief generation
    await page.wait_for_selector("text=Generating Brief", timeout=5000)
    
    # Wait for brief to be generated
    try:
        await page.wait_for_selector("text=Brief Generated", timeout=30000)
    except:
        # Check if brief was created
        await page.wait_for_selector("[data-testid='brief-item']", timeout=15000)
    
    # Verify brief was generated
    brief_element = await page.query_selector("[data-testid='brief-item']")
    assert brief_element is not None

@pytest.mark.asyncio
async def test_export_functionality(page: Page):
    """Test export functionality"""
    # Navigate to exports page
    await page.goto("http://localhost:3000/exports")
    await page.wait_for_load_state("networkidle")
    
    # Click on create export
    await page.click("text=Create Export")
    await page.wait_for_selector("[data-testid='export-form']", timeout=5000)
    
    # Fill export details
    await page.select_option("[data-testid='export-type']", "csv")
    await page.select_option("[data-testid='export-format']", "keywords")
    
    # Submit the form
    await page.click("text=Export")
    
    # Wait for export to start
    await page.wait_for_selector("text=Exporting", timeout=5000)
    
    # Wait for export to complete
    try:
        await page.wait_for_selector("text=Export Complete", timeout=30000)
    except:
        # Check if export was created
        await page.wait_for_selector("[data-testid='export-item']", timeout=15000)
    
    # Verify export was created
    export_element = await page.query_selector("[data-testid='export-item']")
    assert export_element is not None

@pytest.mark.asyncio
async def test_user_authentication(page: Page):
    """Test user authentication flow"""
    # Navigate to login page
    await page.goto("http://localhost:3000/login")
    await page.wait_for_load_state("networkidle")
    
    # Fill login form
    await page.fill("[data-testid='email']", "test@example.com")
    await page.fill("[data-testid='password']", "password123")
    
    # Submit login
    await page.click("text=Login")
    
    # Wait for login to complete
    try:
        await page.wait_for_selector("text=Dashboard", timeout=10000)
        # Verify we're logged in
        dashboard_element = await page.query_selector("text=Dashboard")
        assert dashboard_element is not None
    except:
        # If login fails, check for error message
        error_element = await page.query_selector("[data-testid='error-message']")
        assert error_element is not None

@pytest.mark.asyncio
async def test_responsive_design(page: Page):
    """Test responsive design on different screen sizes"""
    # Test mobile viewport
    await page.set_viewport_size({"width": 375, "height": 667})
    await page.goto("http://localhost:3000")
    await page.wait_for_load_state("networkidle")
    
    # Check if mobile menu is accessible
    mobile_menu = await page.query_selector("[data-testid='mobile-menu']")
    if mobile_menu:
        await mobile_menu.click()
        await page.wait_for_selector("[data-testid='mobile-nav']", timeout=5000)
    
    # Test tablet viewport
    await page.set_viewport_size({"width": 768, "height": 1024})
    await page.goto("http://localhost:3000")
    await page.wait_for_load_state("networkidle")
    
    # Verify layout adapts
    sidebar = await page.query_selector("[data-testid='sidebar']")
    assert sidebar is not None

@pytest.mark.asyncio
async def test_error_handling(page: Page):
    """Test error handling in the UI"""
    # Test 404 page
    await page.goto("http://localhost:3000/nonexistent-page")
    await page.wait_for_load_state("networkidle")
    
    # Check for 404 message
    error_element = await page.query_selector("text=Page Not Found")
    assert error_element is not None
    
    # Test invalid form submission
    await page.goto("http://localhost:3000/projects")
    await page.click("text=Create Project")
    
    # Try to submit without required fields
    await page.click("text=Create")
    
    # Check for validation errors
    error_messages = await page.query_selector_all("[data-testid='error-message']")
    assert len(error_messages) > 0

@pytest.mark.asyncio
async def test_performance_metrics(page: Page):
    """Test performance metrics"""
    # Navigate to dashboard
    await page.goto("http://localhost:3000")
    
    # Measure page load time
    start_time = time.time()
    await page.wait_for_load_state("networkidle")
    load_time = time.time() - start_time
    
    # Page should load within 5 seconds
    assert load_time < 5
    
    # Check for performance metrics
    metrics_element = await page.query_selector("[data-testid='performance-metrics']")
    if metrics_element:
        # Verify metrics are displayed
        assert await metrics_element.is_visible()

if __name__ == "__main__":
    pytest.main([__file__])
