;(async utils => {
  const {fetchData, render, renderEnvironment, getHistogramData, getAverageValue, getPValue} = utils

  const {data, sortedBatchIds} = await fetchData()
  let batchIdA = sortedBatchIds[sortedBatchIds.length - 1]
  let batchIdB = sortedBatchIds[sortedBatchIds.length - 2]

  function createOptionElement(batch) {
    const optionEl = document.createElement('option')
    optionEl.textContent = `${batch.metadata.batchId} - (${batch.metadata.hash.slice(0, 8)})`
    optionEl.value = batch.metadata.batchId
    return optionEl
  }

  function populateHashSelectBoxes(data) {
    const hashASelect = document.getElementById('hash-a-select')
    const hashBSelect = document.getElementById('hash-b-select')
    const optionsA = []
    const optionsB = []

    // Add the entries with most recent first
    const entries = _.sortBy(Object.entries(data), entry => entry[0]).reverse()
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
      renderWithBatches(batchIdA, batchIdB)
    })

    hashBSelect.addEventListener('change', () => {
      batchIdB = hashBSelect.value
      renderWithBatches(batchIdA, batchIdB)
    })
  }

  function renderWithBatches(batchIdA, batchIdB) {
    const graphs = [
      [
        'runtime-histogram',
        () =>
          getHistogramData('timing-total', {where: o => o.batchId === batchIdA}).concat(
            getHistogramData('timing-total', {where: o => o.batchId === batchIdB}),
          ),
        {
          title: `Runtime Distribution`,
          xaxis: {ticksuffix: ' s'},
        },
      ],
      [
        'tti-histogram',
        () =>
          getHistogramData('interactive-deltasPercent', {
            where: o => o.batchId === batchIdA,
          }).concat(
            getHistogramData('interactive-deltasPercent', {where: o => o.batchId === batchIdB}),
          ),
        {
          title: `TTI Deltas Distribution`,
          xaxis: {ticksuffix: ' %'},
        },
      ],
    ]

    const tiles = [
      [
        'runtime-avg-a',
        () => getAverageValue('timing-total', {where: o => o.batchId === batchIdA}),
        {title: 'Avg Runtime A', unit: 's'},
      ],
      [
        'runtime-avg-b',
        () => getAverageValue('timing-total', {where: o => o.batchId === batchIdB}),
        {title: 'Avg Runtime B', unit: 's'},
      ],
      [
        'runtime-avg-pvalue',
        () =>
          getPValue('timing-total', {
            whereA: o => o.batchId === batchIdA,
            whereB: o => o.batchId === batchIdB,
          }),
        {title: 'P-Value', unit: '%'},
      ],
      [
        'tti-avg-a',
        () => getAverageValue('interactive-deltasPercent', {where: o => o.batchId === batchIdA}),
        {title: 'Avg TTI Delta A', unit: '%'},
      ],
      [
        'tti-avg-b',
        () => getAverageValue('interactive-deltasPercent', {where: o => o.batchId === batchIdB}),
        {title: 'Avg TTI Delta B', unit: '%'},
      ],
      [
        'tti-avg-pvalue',
        () =>
          getPValue('interactive-deltasPercent', {
            whereA: o => o.batchId === batchIdA,
            whereB: o => o.batchId === batchIdB,
          }),
        {title: 'P-Value', unit: '%'},
      ],
    ]

    render({graphs, tiles})
    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
  }

  renderWithBatches(batchIdA, batchIdB)
  populateHashSelectBoxes(data)
})(window.utils)
