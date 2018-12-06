;(async utils => {
  const {
    createElement,
    fetchData,
    render,
    renderEnvironment,
    getBoxAndWhiskerData,
    getHistogramData,
    getAverageValue,
    getPValue,
    getGraphTitle,
  } = utils

  const SUFFIX_BY_METRIC = {
    'timing-total': ' s',
    'timing-total-minus-load': ' s',
    'timing-gather-afterpass': ' s',
    'timing-runner-auditing': ' s',
    'first-contentful-paint': ' s',
    interactive: ' s',
    'first-contentful-paint-deltasPercent': ' %',
    'interactive-deltasPercent': ' %',
  }

  function getMetricSuffix(metricName) {
    if (metricName.startsWith('timing')) return ' s'
    return SUFFIX_BY_METRIC[metricName] || ' %'
  }

  const {data, sortedBatchIds} = await fetchData()
  let activeMetric = 'first-contentful-paint'
  let batchIdA = _.find(sortedBatchIds, id => id.startsWith('official')) || sortedBatchIds[0]
  let batchIdB = _.find(sortedBatchIds, id => !id.startsWith('official')) || sortedBatchIds[1]
  resetGraphLabels()

  function resetGraphLabels() {
    data[batchIdA].metadata.uiName = `A (${data[batchIdA].metadata.hash.slice(0, 8)})`
    data[batchIdB].metadata.uiName = `B (${data[batchIdB].metadata.hash.slice(0, 8)})`
  }

  function createOptionElement(batch) {
    const optionEl = document.createElement('option')
    optionEl.textContent = `${batch.metadata.batchId} - (${batch.metadata.hash.slice(0, 8)})`
    optionEl.value = batch.metadata.batchId
    return optionEl
  }

  function populateHashSelectBoxes(data) {
    const hashASelect = document.getElementById('hash-a-select')
    const hashBSelect = document.getElementById('hash-b-select')
    const metricSelect = document.getElementById('metric-select')
    const optionsA = []
    const optionsB = []

    // Add the entries with most recent first
    const entries = _.sortBy(Object.entries(data), ([id, batch]) =>
      batch.metadata.date.getTime(),
    ).reverse()
    for (const [batchId, batch] of entries) {
      const optionElA = createOptionElement(batch)
      optionElA.setAttribute('data-batch', batchId)
      optionElA.selected = batchIdA === batchId
      hashASelect.appendChild(optionElA)
      optionsA.push(optionElA)

      const optionElB = createOptionElement(batch)
      optionElB.setAttribute('data-batch', batchId)
      optionElB.selected = batchIdB === batchId
      hashBSelect.appendChild(optionElB)
      optionsB.push(optionElB)
    }

    hashASelect.addEventListener('change', () => {
      batchIdA = hashASelect.value
      resetGraphLabels()
      renderWithBatches(batchIdA, batchIdB)
    })

    hashBSelect.addEventListener('change', () => {
      batchIdB = hashBSelect.value
      resetGraphLabels()
      renderWithBatches(batchIdA, batchIdB)
    })

    metricSelect.addEventListener('change', () => {
      activeMetric = metricSelect.value
      renderWithBatches(batchIdA, batchIdB)
    })
  }

  function convertMetricToGraphsAndTiles({
    graphsRootEl,
    graphs,
    tiles,
    metric,
    url,
    whereA,
    whereB,
  }) {
    const title = getGraphTitle({url, metric})
    const cleanURL = url.replace(/[^a-z]+/gi, '')
    const domID = `${cleanURL}-${metric}`
    const boxWhere = o => whereA(o) || whereB(o)
    const boxMetric = metric.replace('-deltasPercent', '')
    const boxAndWhiskerData = getBoxAndWhiskerData(boxMetric, {where: boxWhere})
    const histogramDataA = getHistogramData(metric, {where: whereA})
    const histogramDataB = getHistogramData(metric, {where: whereB})
    if (!histogramDataA.length || !histogramDataB.length) return

    const values = _.flatMap(boxAndWhiskerData, set => set.y)
    const max = _.max(values)

    const rowEl = createElement(graphsRootEl, 'div', 'row')

    const histogramEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
    histogramEl.id = `${domID}-hist`
    graphs.push([
      histogramEl.id,
      () => histogramDataA.concat(histogramDataB),
      {
        title,
        xaxis: {ticksuffix: getMetricSuffix(metric)},
      },
    ])

    const boxEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
    boxEl.id = `${domID}-box`
    graphs.push([
      boxEl.id,
      () => boxAndWhiskerData,
      {
        title,
        yaxis: {ticksuffix: getMetricSuffix(boxMetric), range: [0, Math.max(max + 2, 5)]},
        xaxis: {
          zeroline: false,
          showticklabels: false,
        },
      },
    ])

    const tilesEl = createElement(rowEl, 'div', 'col-2', 'tiles-container')
    const avgAEl = createElement(tilesEl, 'div', {id: `${domID}-avg-a`, classes: ['tile']})
    const avgBEl = createElement(tilesEl, 'div', {id: `${domID}-avg-b`, classes: ['tile']})
    const pvalueAEl = createElement(tilesEl, 'div', {id: `${domID}-pvalue`, classes: ['tile']})
    const aValue = getAverageValue(metric, {where: whereA})
    const bValue = getAverageValue(metric, {where: whereB})
    const pValue = getPValue(metric, {whereA, whereB}).value
    tiles.push(
      [avgAEl.id, () => aValue, {title: 'Average A', unit: getMetricSuffix(metric).trim()}],
      [avgBEl.id, () => bValue, {title: 'Average B', unit: getMetricSuffix(metric).trim()}],
      [
        pvalueAEl.id,
        () => pValue,
        {
          aValue,
          bValue,
          pValue: Math.round(pValue),
          magnitude: Math.abs(aValue - bValue),
          title: 'P-Value',
          unit: '%',
          errorThreshold: 5,
          warnThreshold: 15,
          descendingWarn: true,
        },
      ],
    )

    return true
  }

  function renderWithBatches(batchIdA, batchIdB) {
    const graphsRootEl = document.getElementById('graphs')
    graphsRootEl.textContent = ''

    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    const renderElements = []
    for (const url of urls) {
      const urlData = data[batchIdA][url]
      if (!urlData) continue

      const whereA = o => o.url === url && o.batchId === batchIdA
      const whereB = o => o.url === url && o.batchId === batchIdB
      const renderData = {
        url,
        whereA,
        whereB,
        graphsRootEl: document.createDocumentFragment(),
        graphs: [],
        tiles: [],
      }

      if (activeMetric === 'audit-scores' || activeMetric === 'timing-breakdowns') {
        const metricOfInterest = activeMetric === 'audit-scores' ? /^audit-score.*$/ : /^timing-.*$/
        for (const metricName of Object.keys(urlData)) {
          if (!metricOfInterest.test(metricName)) continue
          const {value, statsA, statsB} = getPValue(metricName, {whereA, whereB})
          if (!statsA.length || !statsB.length) continue
          // Skip it if the dataset has no variance and pvalue of 100
          if (statsA[0][1].variance === 0 && statsB[0][1].variance === 0 && value === 100) continue
          // Skip it if the values are too small to care
          if (statsA[0][1].mean < 0.05 && statsB[0][1].mean < 0.05) continue

          convertMetricToGraphsAndTiles({...renderData, metric: metricName})

          if (renderData.graphsRootEl.childElementCount) {
            renderElements.push({...renderData})
            renderData.graphsRootEl = document.createDocumentFragment()
            renderData.graphs = []
            renderData.tiles = []
          }
        }
      } else {
        convertMetricToGraphsAndTiles({...renderData, metric: activeMetric})
        if (renderData.graphsRootEl.childElementCount) renderElements.push(renderData)
      }
    }

    const sortedRenderElements = _.orderBy(
      renderElements,
      [a => a.tiles[2][2].pValue, a => a.tiles[2][2].magnitude],
      ['asc', 'desc'],
    ).slice(0, 50)
    sortedRenderElements.forEach(el => graphsRootEl.appendChild(el.graphsRootEl))
    const graphs = _.flatMap(sortedRenderElements, 'graphs')
    const tiles = _.flatMap(sortedRenderElements, 'tiles')

    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
    render({graphs, tiles})
  }

  renderWithBatches(batchIdA, batchIdB)
  populateHashSelectBoxes(data)
})(window.utils)
