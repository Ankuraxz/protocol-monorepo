import {getSfContext} from '../../../createSdkReduxParts';
import {typeGuard} from '../../../utils';
import {
    NothingString,
    SuperTokenMutationArg,
    TransactionInfo,
} from '../../argTypes';
import {registerNewTransaction} from '../../transactions/registerNewTransaction';
import {monitorAddressForNextEventToInvalidateCache} from '../cacheTags/monitorAddressForNextEventToInvalidateCache';
import {rtkQuerySlice} from '../rtkQuerySlice';
import {MutationMeta} from '../rtkQuerySliceBaseQuery';

/**
 * Distributes `amount` of token to an index
 * @param indexId The id of the index.
 * @param amountWei The amount of tokens to be distributed.
 * @param userDataBytes Extra user data provided.
 */
export type DistributeToIndexArg = SuperTokenMutationArg & {
    indexId: string;
    amountWei: string;
    userDataBytes: string | NothingString;
};

const apiSlice = rtkQuerySlice.injectEndpoints({
    endpoints: (builder) => ({
        distributeToIndex: builder.mutation<
            TransactionInfo,
            DistributeToIndexArg
        >({
            queryFn: async (arg, queryApi) => {
                const [framework, signer] =
                    await getSfContext().getFrameworkAndSigner(arg.chainId);

                const [superToken, signerAddress] = await Promise.all([
                    framework.loadSuperToken(arg.superTokenAddress),
                    signer.getAddress(),
                ]);

                const transactionResponse = await superToken
                    .distribute({
                        indexId: arg.indexId,
                        userData: arg.userDataBytes,
                        amount: arg.amountWei,
                    })
                    .exec(signer);

                await registerNewTransaction(
                    arg.chainId,
                    transactionResponse.hash,
                    !!arg.waitForConfirmation,
                    queryApi.dispatch
                );

                return {
                    data: typeGuard<TransactionInfo>({
                        hash: transactionResponse.hash,
                        chainId: arg.chainId,
                    }),
                    meta: typeGuard<MutationMeta>({
                        monitorAddress: signerAddress,
                    }),
                };
            },
            onQueryStarted: async (_arg, {dispatch, queryFulfilled}) => {
                queryFulfilled.then(async (queryResult) =>
                    monitorAddressForNextEventToInvalidateCache(
                        queryResult.meta!.monitorAddress,
                        queryResult.data,
                        dispatch
                    )
                );
            },
        }),
    }),
    overrideExisting: false,
});

export const {
    /**
     * Documentation: {@link DistributeToIndexArg}
     * @category React Hooks
     */
    useDistributeToIndexMutation,
} = apiSlice;
