;(async utils => {
  const {
    fetchAndRender,
    fetchData,
    render,
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
    getMetricDisplayName,
  } = utils

  let activeMetric = 'first-contentful-paint'
  const {data, currentBatchId} = await fetchData()

  function createOptionElement(metric) {
    const optionEl = document.createElement('option')
    optionEl.textContent = getMetricDisplayName(metric)
    optionEl.value = metric
    return optionEl
  }

  function populateMetricSelectBox(data) {
    const metricSelectEl = document.getElementById('metric-select')
    const metricsByGroup = _(data[currentBatchId])
      .values()
      .map(urlData => Object.keys(urlData))
      .flatten()
      .uniq()
      .groupBy(metric => {
        if (metric.startsWith('audit-score')) return 'Audit Scores'
        if (metric.startsWith('timing-')) return 'Timings'
        if (metric.startsWith('diagnostic-')) return 'Diagnostics'
        return 'Metric'
      })
      .value()

    for (const [groupName, metrics] of Object.entries(metricsByGroup)) {
      let groupEl = metricSelectEl
      if (groupName) {
        groupEl = document.createElement('optgroup')
        groupEl.label = groupName
        metricSelectEl.appendChild(groupEl)
      }

      for (const metric of metrics) {
        // Skip the meta-metrics
        if (/-(delta|stddev|mean)/.test(metric)) continue

        const optEl = createOptionElement(metric)
        if (metric === activeMetric) optEl.selected = true
        groupEl.appendChild(optEl)
      }
    }

    metricSelectEl.addEventListener('change', () => {
      activeMetric = metricSelectEl.value
      renderActiveMetric()
    })
  }

  function createGraphElements(graphs, {id, title}) {
    const chunks = _.chunk(graphs, 3)
    const graphRootEl = document.getElementById(id)
    graphRootEl.textContent = ''

    const titleEl = document.createElement('h2')
    titleEl.textContent = title
    graphRootEl.appendChild(titleEl)

    for (const chunk of chunks) {
      const rowEl = document.createElement('div')
      rowEl.classList.add('row')
      for (const [id] of chunk) {
        const graphEl = document.createElement('div')
        graphEl.id = id
        graphEl.classList.add('col-4', 'graph-container')
        rowEl.appendChild(graphEl)
      }

      graphRootEl.appendChild(rowEl)
    }
  }

  function buildGraph({url, cleanURL}, {suffix, metric, title}) {
    const boxAndWhiskerData = getBoxAndWhiskerData(metric, {where: o => o.url === url})
    const values = _.flatMap(boxAndWhiskerData, set => set.y)
    const max = _.max(values)
    const maxWithPadding = max + Math.round(max * 0.1)
    const isPercentStyleMetric = metric.startsWith('audit-score')
    const isSmallTiming = metric.startsWith('timing') && max < 1
    let yaxisValue = {ticksuffix: ' s', range: [0, Math.max(max + 2, 5)]}
    if (isPercentStyleMetric) yaxisValue = {ticksuffix: ' %', range: [0, 100]}

    if (metric.startsWith('diagnostic')) {
      yaxisValue = {ticksuffix: '', range: [0, maxWithPadding]}
    }

    if (isSmallTiming) {
      yaxisValue = {ticksuffix: ' ms', range: [0, Math.max(max * 1500, 100)]}
      boxAndWhiskerData.forEach(set => (set.y = set.y.map(value => value * 1000)))
    }

    return [
      `${cleanURL}-${suffix}`,
      () => boxAndWhiskerData,
      {
        title: url,
        yaxis: yaxisValue,
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ]
  }

  async function renderActiveMetric() {
    const graphs = []
    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    for (const url of urls) {
      const cleanURL = url.replace(/[^a-z]+/gi, '')
      const site = {url, cleanURL}
      graphs.push(buildGraph(site, {suffix: 'active', metric: activeMetric}))
    }

    createGraphElements(graphs, {
      id: 'active-graphs',
      title: `${getMetricDisplayName(activeMetric)} Over Time`,
    })
    render({graphs: graphs})
  }

  renderActiveMetric()
  populateMetricSelectBox(data)
})(window.utils)
