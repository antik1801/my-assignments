import { useQuery } from '@tanstack/react-query';
import React from 'react';
import useAxiosSecure from './useAxiosSecure';

const useUsers = () => {
    const [axiosSecure] = useAxiosSecure();
    const {isLoading, refetch , data: users = []} = useQuery({
        queryKey:['users'],
        queryFn: async () =>{
            const res = await axiosSecure.get(`/users`)
            return res.data;
        }
    })
    return [users, refetch, isLoading]
};

export default useUsers;