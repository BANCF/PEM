if (typeof window.jQuery !== 'undefined') {
    window.jQuery(document).ajaxComplete((event, xhr, settings) => {
        window.dispatchEvent(new CustomEvent('OHKE_API_DONE', { detail: settings.url }));
    });
}
