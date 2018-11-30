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
  } = utils

  const SUFFIX_BY_METRIC = {
    'timing-total': ' s',
    'first-contentful-paint': ' s',
    interactive: ' s',
    'first-contentful-paint-deltasPercent': ' %',
    'interactive-deltasPercent': ' %',
  }

  function getMetricSuffix(metricName) {
    return SUFFIX_BY_METRIC[metricName] || ' %'
  }

  const {data, sortedBatchIds} = await fetchData()
  let activeMetric = 'timing-total'
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
        title: url,
        xaxis: {ticksuffix: getMetricSuffix(metric)},
      },
    ])

    const boxEl = createElement(rowEl, 'div', 'col-5', 'graph-container')
    boxEl.id = `${domID}-box`
    graphs.push([
      boxEl.id,
      () => boxAndWhiskerData,
      {
        title: url,
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
    tiles.push(
      [
        avgAEl.id,
        () => getAverageValue(metric, {where: whereA}),
        {title: 'Average A', unit: getMetricSuffix(metric).trim()},
      ],
      [
        avgBEl.id,
        () => getAverageValue(metric, {where: whereB}),
        {title: 'Average B', unit: getMetricSuffix(metric).trim()},
      ],
      [
        pvalueAEl.id,
        () => getPValue(metric, {whereA, whereB}).value,
        {
          title: 'P-Value',
          unit: '%',
          errorThreshold: 5,
          warnThreshold: 15,
          descendingWarn: true,
        },
      ],
    )
  }

  function renderWithBatches(batchIdA, batchIdB) {
    const graphsRootEl = document.getElementById('graphs')
    graphsRootEl.textContent = ''

    const graphs = []
    const tiles = []
    const urls = _(data)
      .values()
      .flatMap(o => _.keys(o))
      .uniq()
      .value()

    for (const url of urls) {
      const urlData = data[batchIdA][url]
      if (!urlData) continue

      const whereA = o => o.url === url && o.batchId === batchIdA
      const whereB = o => o.url === url && o.batchId === batchIdB
      const renderData = {graphs, tiles, url, whereA, whereB, graphsRootEl}

      if (/^audit-scores/.test(activeMetric)) {
        for (const metricName of Object.keys(urlData)) {
          // Look at the mean of all the audits
          if (!/audit-score.*-mean/.test(metricName)) continue

          const {statsA, statsB} = getPValue(metricName, {whereA, whereB})
          if (statsA[0][1].variance === 0 && statsB[0][1].variance === 0) continue

          convertMetricToGraphsAndTiles({...renderData, metric: metricName})
        }
      } else {
        convertMetricToGraphsAndTiles({...renderData, metric: activeMetric})
      }
    }

    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
    render({graphs, tiles})
  }

  renderWithBatches(batchIdA, batchIdB)
  populateHashSelectBoxes(data)
})(window.utils)
