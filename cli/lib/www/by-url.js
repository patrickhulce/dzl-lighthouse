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

  function createGraphElements(graphs, {id, title}) {
    const chunks = _.chunk(graphs, 3)
    const graphRootEl = document.getElementById(id)
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

    return [
      `${cleanURL}-${suffix}`,
      () => boxAndWhiskerData,
      {
        title: url,
        yaxis: {ticksuffix: ' s', range: [0, Math.max(max + 2, 5)]},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ]
  }

  const {data} = await fetchData()
  const graphs = {runtime: [], fcp: [], tti: []}
  const urls = _(data)
    .values()
    .flatMap(o => _.keys(o))
    .uniq()
    .value()

  for (const url of urls) {
    const cleanURL = url.replace(/[^a-z]+/gi, '')
    const site = {url, cleanURL}
    graphs.runtime.push(buildGraph(site, {suffix: 'runtime', metric: 'timing-total'}))
    graphs.fcp.push(buildGraph(site, {suffix: 'fcp', metric: 'first-contentful-paint'}))
    graphs.tti.push(buildGraph(site, {suffix: 'tti', metric: 'interactive'}))
  }

  createGraphElements(graphs.runtime, {id: 'runtime-graphs', title: 'Runtime Over Time'})
  createGraphElements(graphs.fcp, {id: 'fcp-graphs', title: 'FCP Over Time'})
  createGraphElements(graphs.tti, {id: 'tti-graphs', title: 'TTI Over Time'})
  render({graphs: graphs.runtime.concat(graphs.fcp).concat(graphs.tti)})
})(window.utils)
