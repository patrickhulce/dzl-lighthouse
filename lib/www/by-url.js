;(async utils => {
  const {
    fetchAndRender,
    fetchData,
    render,
    getBoxAndWhiskerData,
    getHistogramData,
    get99thValue,
    getAverageValue,
  } = utils

  function createGraphElements(graphs) {
    const rowEl = document.createElement('div')
    rowEl.classList.add('row')
    for (const [id] of graphs) {
      const graphEl = document.createElement('div')
      graphEl.id = id
      graphEl.classList.add('col-4', 'graph-container')
      rowEl.appendChild(graphEl)
    }

    const graphRootEl = document.getElementById('graphs')
    graphRootEl.appendChild(rowEl)
  }

  function buildGraph({url, cleanURL}, {suffix, metric, title}) {
    const boxAndWhiskerData = getBoxAndWhiskerData(metric, {where: o => o.url === url})
    const values = _.flatMap(boxAndWhiskerData, set => set.y)
    const max = _.max(values)

    return [
      `${cleanURL}-${suffix}`,
      () => boxAndWhiskerData,
      {
        title: `${url} ${title}`,
        yaxis: {ticksuffix: ' s', range: [0, Math.max(max + 2, 5)]},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ]
  }

  const {data} = await fetchData()
  const allGraphs = []
  const urls = _(data)
    .values()
    .flatMap(o => _.keys(o))
    .uniq()
    .value()

  for (const url of urls) {
    const cleanURL = url.replace(/[^a-z]+/gi, '')
    const site = {url, cleanURL}
    const graphs = [
      buildGraph(site, {suffix: 'runtime', metric: 'timing-total', title: 'Runtime Over Time'}),
      buildGraph(site, {suffix: 'fcp', metric: 'first-contentful-paint', title: 'FCP Over Time'}),
      buildGraph(site, {suffix: 'tti', metric: 'interactive', title: 'TTI Over Time'}),
    ]

    createGraphElements(graphs)
    allGraphs.push(...graphs)
  }

  render({graphs: allGraphs})
  document.body.classList.remove('is-loading')
})(window.utils)
