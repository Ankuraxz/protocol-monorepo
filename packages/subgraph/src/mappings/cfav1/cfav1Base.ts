import { Address, BigInt } from "@graphprotocol/graph-ts";
import { FlowUpdated as FlowUpdatedEvent } from "../../../generated/ConstantFlowAgreementV1/IConstantFlowAgreementV1";
import { FlowUpdated } from "../../../generated/schema";
import {
    createEventID,
    getOrInitStream,
    updateATSBalance,
    updateATSFlowRates,
    updateAggregateEntitiesStreamData,
    BIG_INT_ZERO,
    getOrInitStreamRevision,
    updateAccountUpdatedAt,
    tokenHasValidHost,
} from "../../utils";

enum FlowActionType {
    create,
    update,
    terminate,
}

function createFlowUpdatedEntity(
    event: FlowUpdatedEvent,
    oldFlowRate: BigInt
): void {
    let ev = new FlowUpdated(createEventID(event));
    ev.transactionHash = event.transaction.hash;
    ev.timestamp = event.block.timestamp;
    ev.blockNumber = event.block.number;
    ev.token = event.params.token;
    ev.sender = event.params.sender;
    ev.receiver = event.params.receiver;
    ev.flowRate = event.params.flowRate;
    ev.totalSenderFlowRate = event.params.totalSenderFlowRate;
    ev.totalReceiverFlowRate = event.params.totalReceiverFlowRate;
    ev.userData = event.params.userData;
    ev.oldFlowRate = oldFlowRate;

    let type = oldFlowRate.equals(BIG_INT_ZERO)
        ? FlowActionType.create
        : event.params.flowRate.equals(BIG_INT_ZERO)
        ? FlowActionType.terminate
        : FlowActionType.update;
    ev.type = type;
    ev.save();
}

export function handleStreamUpdated(
    event: FlowUpdatedEvent,
    hostAddress: Address
): void {
    let senderAddress = event.params.sender;
    let receiverAddress = event.params.receiver;
    let tokenAddress = event.params.token;
    let flowRate = event.params.flowRate;
    let currentTimestamp = event.block.timestamp;

    let hasValidHost = tokenHasValidHost(hostAddress, tokenAddress);
    if (!hasValidHost) {
        return;
    }

    let stream = getOrInitStream(
        hostAddress,
        senderAddress,
        receiverAddress,
        tokenAddress,
        currentTimestamp
    );
    let oldFlowRate = stream.currentFlowRate;

    let timeSinceLastUpdate = currentTimestamp.minus(stream.updatedAt);
    let amountStreamedSinceLastUpdate = oldFlowRate.times(timeSinceLastUpdate);
    let newStreamedUntilLastUpdate = stream.streamedUntilUpdatedAt.plus(
        amountStreamedSinceLastUpdate
    );
    stream.currentFlowRate = flowRate;
    stream.streamedUntilUpdatedAt = newStreamedUntilLastUpdate;
    stream.save();

    let senderId = senderAddress.toHex();
    let receiverId = receiverAddress.toHex();
    let tokenId = tokenAddress.toHex();

    let flowRateDelta = flowRate.minus(oldFlowRate);
    let isCreate = oldFlowRate.equals(BIG_INT_ZERO);
    let isDelete = flowRate.equals(BIG_INT_ZERO);
    if (isDelete) {
        let streamRevision = getOrInitStreamRevision(
            senderId,
            receiverId,
            tokenId
        );
        streamRevision.revisionIndex = streamRevision.revisionIndex + 1;
        streamRevision.save();
    }

    // update Account updatedAt field
    updateAccountUpdatedAt(hostAddress, senderAddress, currentTimestamp);
    updateAccountUpdatedAt(hostAddress, receiverAddress, currentTimestamp);

    // create event entity
    createFlowUpdatedEntity(event, oldFlowRate);

    // update aggregate entities data
    updateATSBalance(senderId, tokenId, currentTimestamp);
    updateATSBalance(receiverId, tokenId, currentTimestamp);
    updateATSFlowRates(
        senderId,
        receiverId,
        tokenId,
        flowRateDelta,
        currentTimestamp
    );
    updateAggregateEntitiesStreamData(
        senderId,
        receiverId,
        tokenId,
        flowRateDelta,
        isCreate,
        isDelete,
        currentTimestamp,
        amountStreamedSinceLastUpdate
    );
}