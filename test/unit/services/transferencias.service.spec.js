const { expect } = require('chai'); // Biblioteca de asserção
const sinon = require('sinon'); // Biblioteca para criar stubs/mocks

const contasModel = require('../../../src/models/contasModel');
const transferenciasModel = require('../../../src/models/transferenciasModel');
const { realizarTransferencia } = require('../../../src/services/transferenciasService');

describe('realizarTransferencia', function () {
  // Restaura todos os stubs após cada teste para não contaminar os próximos
  afterEach(function () {
    sinon.restore();
  });

  it('deve realizar a transferência com sucesso quando as contas são válidas e o valor é menor que R$ 5.000,00', async function () {
    // Simula a busca da conta de origem e da conta de destino
    sinon.stub(contasModel, 'getContaById')
      .onFirstCall().resolves({ id: 1, ativa: true, saldo: 2000 })
      .onSecondCall().resolves({ id: 2, ativa: true, saldo: 500 });

    // Simula a atualização de saldo sem acessar banco real
    const atualizarSaldoStub = sinon.stub(contasModel, 'atualizarSaldo').resolves();

    // Simula o registro da transferência sem gravar nada de verdade
    const inserirTransferenciaStub = sinon.stub(transferenciasModel, 'inserirTransferencia').resolves();

    // Executa a função que está sendo testada
    const resultado = await realizarTransferencia(1, 2, 1000, null);

    // Valida o retorno esperado da função
    expect(resultado).to.deep.equal({
      message: 'Transferência realizada com sucesso.'
    });

    // Garante que as duas contas foram consultadas
    expect(contasModel.getContaById.calledTwice).to.equal(true);
    expect(contasModel.getContaById.firstCall.calledWithExactly(1)).to.equal(true);
    expect(contasModel.getContaById.secondCall.calledWithExactly(2)).to.equal(true);

    // Garante que o saldo foi debitado da origem e creditado no destino
    expect(atualizarSaldoStub.firstCall.calledWithExactly(1, -1000)).to.equal(true);
    expect(atualizarSaldoStub.secondCall.calledWithExactly(2, 1000)).to.equal(true);

    // Garante que a transferência foi registrada como não autenticada
    expect(inserirTransferenciaStub.calledOnceWithExactly(1, 2, 1000, false)).to.equal(true);
  });

  it('deve lançar erro 401 quando o valor for acima de R$ 5.000,00 e o token for inválido', async function () {
    // Simula contas válidas e ativas para o teste focar apenas na regra do token
    sinon.stub(contasModel, 'getContaById')
      .onFirstCall().resolves({ id: 1, ativa: true, saldo: 10000 })
      .onSecondCall().resolves({ id: 2, ativa: true, saldo: 500 });

    // Cria stubs para confirmar que essas funções NÃO serão chamadas em caso de erro
    const atualizarSaldoStub = sinon.stub(contasModel, 'atualizarSaldo').resolves();
    const inserirTransferenciaStub = sinon.stub(transferenciasModel, 'inserirTransferencia').resolves();

    let erroCapturado;

    try {
      // Executa o cenário inválido: valor alto com token incorreto
      await realizarTransferencia(1, 2, 6000, '000000');
    } catch (error) {
      // Guarda o erro para validar depois
      erroCapturado = error;
    }

    // Valida se a função lançou o erro esperado
    expect(erroCapturado).to.exist;
    expect(erroCapturado.status).to.equal(401);
    expect(erroCapturado.message).to.equal('Autenticação necessária para transferências acima de R$5.000,00.');

    // Garante que nada foi alterado quando a validação falhou
    expect(atualizarSaldoStub.notCalled).to.equal(true);
    expect(inserirTransferenciaStub.notCalled).to.equal(true);
  });

  it('deve aceitar transferência no valor exato de R$ 10,00', async function () {
    // Simula contas válidas para testar o limite mínimo permitido
    sinon.stub(contasModel, 'getContaById')
      .onFirstCall().resolves({ id: 1, ativa: true, saldo: 100 })
      .onSecondCall().resolves({ id: 2, ativa: true, saldo: 50 });

    const atualizarSaldoStub = sinon.stub(contasModel, 'atualizarSaldo').resolves();
    const inserirTransferenciaStub = sinon.stub(transferenciasModel, 'inserirTransferencia').resolves();

    // Executa o caso de borda: valor exatamente no limite mínimo aceito
    const resultado = await realizarTransferencia(1, 2, 10, null);

    // Valida que o valor 10 é aceito pela regra
    expect(resultado).to.deep.equal({
      message: 'Transferência realizada com sucesso.'
    });

    // Confirma os valores exatos debitados e creditados
    expect(atualizarSaldoStub.firstCall.calledWithExactly(1, -10)).to.equal(true);
    expect(atualizarSaldoStub.secondCall.calledWithExactly(2, 10)).to.equal(true);

    // Confirma o registro correto da transferência
    expect(inserirTransferenciaStub.calledOnceWithExactly(1, 2, 10, false)).to.equal(true);
  });

  it('deve realizar a transferência com sucesso quando o valor é acima de R$ 5.000,00 e o token é válido', async function () {
    // ARRANGE - Prepara os dados e stubs necessários
    sinon.stub(contasModel, 'getContaById')
      .onFirstCall().resolves({ id: 1, ativa: true, saldo: 15000 })
      .onSecondCall().resolves({ id: 2, ativa: true, saldo: 1000 });

    const atualizarSaldoStub = sinon.stub(contasModel, 'atualizarSaldo').resolves();
    const inserirTransferenciaStub = sinon.stub(transferenciasModel, 'inserirTransferencia').resolves();

    // ACT - Executa a função sendo testada
    const resultado = await realizarTransferencia(1, 2, 10000, '123456');

    // ASSERT - Valida o comportamento esperado
    expect(resultado).to.deep.equal({
      message: 'Transferência realizada com sucesso.'
    });

    // Valida que as duas contas foram consultadas corretamente
    expect(contasModel.getContaById.calledTwice).to.equal(true);
    expect(contasModel.getContaById.firstCall.calledWithExactly(1)).to.equal(true);
    expect(contasModel.getContaById.secondCall.calledWithExactly(2)).to.equal(true);

    // Valida que os saldos foram atualizados corretamente
    expect(atualizarSaldoStub.calledTwice).to.equal(true);
    expect(atualizarSaldoStub.firstCall.calledWithExactly(1, -10000)).to.equal(true);
    expect(atualizarSaldoStub.secondCall.calledWithExactly(2, 10000)).to.equal(true);

    // Valida que a transferência foi registrada com autenticada = true
    expect(inserirTransferenciaStub.calledOnceWithExactly(1, 2, 10000, true)).to.equal(true);
  });
});